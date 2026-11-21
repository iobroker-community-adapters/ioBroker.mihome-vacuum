/**
 * The commands of the family "robot" of the shared catalog of sendTo commands (ioBroker.assistant HELP.md):
 * getRooms, clean, pause, stop, home, getStatus. They take the parameters of the catalog, call the commands of the
 * Roborock manager (lib/vacuum.ts onMessage) and answer in the form of the catalog: success = an object without
 * `error`, failure = {error: text, reason: code}.
 */
import { cleanStates, errorTexts } from './vacuumProtocol';

/** The names of the commands, the same as in the catalog (`standard: 'robot.<name>'`) */
export const ROBOT_COMMANDS = ['getRooms', 'clean', 'pause', 'stop', 'home', 'getStatus'];

export interface RobotRoom {
    /** ID of the room channel, e.g. mihome-vacuum.0.rooms.16 */
    id: string;
    /** The ioBroker room the channel is assigned to, else the name of the channel */
    name: string;
    /** ID of that ioBroker room (enum.rooms.*) */
    room?: string;
    /** Segment number of the robot (rooms.<room>.mapIndex) */
    segment?: number;
    /** Or the zone coordinates "[x1,y1,x2,y2,passes]" of a room added by hand */
    zone?: string;
}

type Answer = Record<string, unknown>;
type Send = (message: Answer) => Promise<unknown>;

export interface RobotAdapter {
    namespace: string;
    getForeignObjectsAsync(pattern: string, type?: any): Promise<Record<string, any> | null | undefined>;
    getForeignObjectAsync(id: string): Promise<any>;
    getForeignStatesAsync(pattern: string): Promise<Record<string, any> | null | undefined>;
}

interface RobotManager {
    onMessage?: (obj: Answer) => Promise<unknown>;
    activeChannels?: string[] | null;
}

/** Codes thrown by lib/miio.ts sendMessage → reasons of the catalog */
const REASONS: Record<string, string> = {
    MIIO_NOT_CONNECTED: 'NOT_CONNECTED',
    MIIO_CLOSED: 'NOT_CONNECTED',
    MIIO_SEND_FAILED: 'NOT_CONNECTED',
    MIIO_TIMEOUT: 'TIMEOUT',
};

/** Optional parameters of cleanSegments / cleanZone that clean passes on */
const CLEAN_OPTIONS = ['fanSpeed', 'waterBoxMode', 'waterBoxLevel', 'mopMode', 'repeat'];

const fail = (error: string, reason: string, extra: Answer = {}): Answer => ({ error, reason, ...extra });

function thrown(error: unknown): Answer {
    const code =
        error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : '';
    return fail(error instanceof Error ? error.message : String(error), REASONS[code] || 'COMMAND_FAILED');
}

/**
 * The answer of the robot ({id, result} or {error: {code, message}}) → {ok: true, ...} or the catalog failure
 *
 * @param answer the answer of Miio.sendMessage
 */
function robotAnswer(answer: unknown): Answer {
    const raw = answer && typeof answer === 'object' ? (answer as Answer) : {};
    if (raw.error) {
        const error = raw.error as { code?: unknown; message?: unknown };
        const text = typeof error.message === 'string' && error.message ? `: ${error.message}` : '';
        return fail(`The robot refused the command${text}`, 'ROBOT_ERROR', { code: error.code });
    }
    return { ...raw, ok: true };
}

/**
 * info.state of a Roborock robot → the state of the catalog ('idle' is not in the catalog: nothing else fits)
 *
 * @param code info.state (cleanStates)
 * @param battery battery in %
 */
export function robotState(code: number, battery?: number): string {
    switch (code) {
        case cleanStates.Remote:
        case cleanStates.Cleaning:
        case cleanStates.ManuellMode:
        case cleanStates.SpotCleaning:
        case cleanStates.GoingToSpot:
        case cleanStates.ZoneCleaning:
        case cleanStates.RoomCleaning:
        case cleanStates.CleaningMop:
        case cleanStates.GoingMopClean:
            return 'cleaning';
        case cleanStates.Back_toHome:
        case cleanStates.Docking:
            return 'returning';
        case cleanStates.Charging:
            return battery !== undefined && battery >= 100 ? 'docked' : 'charging';
        case cleanStates.DustCollecting:
            return 'docked';
        case cleanStates.Pause:
            return 'paused';
        case cleanStates.Charging_Error:
        case cleanStates.InError:
            return 'error';
        default:
            return 'idle';
    }
}

/**
 * The room channels the robot can clean, named by the ioBroker room they are assigned to
 *
 * @param adapter the instance
 */
export async function listRooms(adapter: RobotAdapter): Promise<RobotRoom[]> {
    const prefix = `${adapter.namespace}.rooms.`;
    const [channels, states, enums, config] = await Promise.all([
        adapter.getForeignObjectsAsync(`${prefix}*`, 'channel'),
        adapter.getForeignStatesAsync(`${prefix}*`),
        adapter.getForeignObjectsAsync('enum.rooms.*', 'enum'),
        adapter.getForeignObjectAsync('system.config'),
    ]);
    const language = config?.common?.language || 'en';
    const text = (name: any): string =>
        typeof name === 'string'
            ? name
            : name && typeof name === 'object'
              ? String(name[language] || name.en || Object.values(name)[0] || '')
              : '';
    const rooms: RobotRoom[] = [];
    for (const channel of Object.values(channels || {})) {
        const id: string = channel._id;
        if (!id.startsWith(prefix) || id.slice(prefix.length).includes('.')) {
            continue;
        }
        const mapIndex = states?.[`${id}.mapIndex`]?.val;
        const room = Object.values(enums || {}).find(e =>
            (e.common?.members || []).some((m: string) => m === id || m.startsWith(`${id}.`)),
        );
        const entry: RobotRoom = { id, name: text(room?.common?.name) || text(channel.common?.name) || id };
        if (room) {
            entry.room = room._id;
        }
        if (mapIndex !== null && mapIndex !== '' && !Number.isNaN(Number(mapIndex))) {
            entry.segment = Number(mapIndex);
        } else if (typeof mapIndex === 'string' && mapIndex.startsWith('[')) {
            entry.zone = mapIndex;
        } else {
            continue; // "not available": the robot does not know this room (any more)
        }
        rooms.push(entry);
    }
    return rooms;
}

/**
 * One room of the user (a name, an ID, an ioBroker room or a segment number) → the room channels
 *
 * @param wanted what the user gave
 * @param rooms the rooms of listRooms
 */
function resolveRoom(wanted: unknown, rooms: RobotRoom[]): RobotRoom[] | Answer {
    const query = String(wanted).trim().toLowerCase();
    const short = (room: RobotRoom): string => room.id.split('.').pop() as string;
    const exact = rooms.filter(
        room =>
            room.id.toLowerCase() === query ||
            room.id.toLowerCase().endsWith(`.rooms.${query}`) ||
            short(room).toLowerCase() === query ||
            room.name.toLowerCase() === query ||
            room.room?.toLowerCase() === query ||
            String(room.segment) === query,
    );
    if (exact.length) {
        return exact;
    }
    const candidates = [...new Set(rooms.map(room => room.name))];
    const partial = rooms.filter(room => query && room.name.toLowerCase().includes(query));
    const names = [...new Set(partial.map(room => room.name))];
    if (names.length > 1) {
        return fail(`"${String(wanted)}" fits several rooms: ${names.join(', ')}`, 'AMBIGUOUS', { candidates: names });
    }
    if (!partial.length) {
        return fail(`The robot knows no room "${String(wanted)}"`, 'NOT_FOUND', { candidates });
    }
    return partial;
}

async function clean(adapter: RobotAdapter, onMessage: Send, message: any): Promise<Answer> {
    let wanted = message && typeof message === 'object' ? message.rooms : message;
    if (typeof wanted === 'string') {
        wanted = wanted.split(',');
    }
    const list = (Array.isArray(wanted) ? wanted : wanted === undefined || wanted === null ? [] : [wanted]).filter(
        room => String(room).trim(),
    );
    if (!list.length) {
        const answer = robotAnswer(await onMessage({ command: 'startVacuuming' }));
        return answer.error ? answer : { ok: true, all: true, rooms: [] };
    }
    const known = await listRooms(adapter);
    const chosen: RobotRoom[] = [];
    for (const room of list) {
        const found = resolveRoom(room, known);
        if (!Array.isArray(found)) {
            return found;
        }
        chosen.push(...found.filter(r => !chosen.includes(r)));
    }
    const options: Answer = {};
    for (const option of CLEAN_OPTIONS) {
        if (message && typeof message === 'object' && message[option] !== undefined) {
            options[option] = message[option];
        }
    }
    // the same jobs as RoomManager.cleanRooms: segments and zones apart
    const segments = chosen.filter(room => room.segment !== undefined);
    const zones = chosen.filter(room => room.zone !== undefined);
    const jobs: Answer[] = [];
    if (segments.length) {
        const ids = segments.map(room => room.id);
        jobs.push({ command: 'cleanSegments', message: { segments: segments.map(r => r.segment), channels: ids } });
    }
    if (zones.length) {
        jobs.push({ command: 'cleanZone', message: { zones: zones.map(r => r.zone), channels: zones.map(r => r.id) } });
    }
    let pending = false;
    for (const job of jobs) {
        const answer = await onMessage({ ...job, ...options });
        if (answer === undefined) {
            pending = true; // waits in the queue (info.queue) behind a running cleaning
        } else if (robotAnswer(answer).error) {
            return robotAnswer(answer);
        }
    }
    const rooms = [...new Set(chosen.map(room => room.name))];
    return pending ? { ok: true, pending: true, rooms } : { ok: true, rooms };
}

async function getStatus(adapter: RobotAdapter, vacuum: RobotManager, onMessage: Send): Promise<Answer> {
    const raw = await onMessage({ command: 'getStatus' });
    const answer = robotAnswer(raw);
    const result = answer.result;
    const status = Array.isArray(result) ? result[0] : result;
    if (answer.error || !status || typeof status !== 'object') {
        return answer.error ? answer : fail('The robot sent no status', 'COMMAND_FAILED');
    }
    delete answer.ok;
    const code = Number(status.state);
    const battery = Number(status.battery);
    answer.state = robotState(code, battery);
    answer.stateCode = code;
    answer.battery = battery;
    if (status.error_code) {
        answer.error = errorTexts[status.error_code] || `Error ${status.error_code}`;
    }
    if (answer.state === 'cleaning' && vacuum.activeChannels?.length) {
        const active = vacuum.activeChannels;
        const names = (await listRooms(adapter)).filter(room => active.includes(room.id)).map(room => room.name);
        if (names.length) {
            answer.room = [...new Set(names)].join(', ');
        }
    }
    return answer;
}

/**
 * Answers one command of ROBOT_COMMANDS; never throws.
 *
 * @param adapter the instance
 * @param vacuum the manager of the robot (null while not connected)
 * @param obj the message
 */
export async function robotCommand(adapter: RobotAdapter, vacuum: RobotManager | null, obj: any): Promise<Answer> {
    try {
        if (obj.command === 'getRooms') {
            return { rooms: await listRooms(adapter) };
        }
        if (!vacuum) {
            return fail('The robot is not connected yet', 'NOT_CONNECTED');
        }
        if (typeof vacuum.onMessage !== 'function') {
            return fail(
                'This command works only with Roborock robots: use the states of the instance',
                'NOT_SUPPORTED',
            );
        }
        const onMessage: Send = message => (vacuum.onMessage as Send).call(vacuum, message);
        switch (obj.command) {
            case 'clean':
                return await clean(adapter, onMessage, obj.message);
            case 'pause':
                return robotAnswer(await onMessage({ command: 'pause' }));
            case 'stop':
                return robotAnswer(await onMessage({ command: 'stopVacuuming' }));
            case 'home':
                return robotAnswer(await onMessage({ command: 'charge' }));
            case 'getStatus':
                return await getStatus(adapter, vacuum, onMessage);
            default:
                return fail(`Unknown command ${obj.command}`, 'NOT_SUPPORTED');
        }
    } catch (error) {
        return thrown(error);
    }
}

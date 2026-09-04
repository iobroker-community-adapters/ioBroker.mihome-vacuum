declare const commands: {
    readonly find: {
        readonly method: "find_me";
    };
    readonly start: {
        readonly method: "app_start";
    };
    readonly pause: {
        readonly method: "app_pause";
    };
    readonly home: {
        readonly method: "app_charge";
    };
    readonly get_status: {
        readonly method: "get_status";
    };
    readonly get_consumable: {
        readonly method: "get_consumable";
    };
    readonly get_carpet_mode: {
        readonly method: "get_carpet_mode";
    };
    readonly get_sound_volume: {
        readonly method: "get_sound_volume";
    };
    readonly sound_volume: {
        readonly method: "change_sound_volume";
    };
    readonly sound_volume_test: {
        readonly method: "test_sound_volume";
    };
    readonly fan_power: {
        readonly method: "set_custom_mode";
    };
    readonly mop_mode: {
        readonly method: "set_mop_mode";
    };
    readonly water_box_mode: {
        readonly method: "set_water_box_custom_mode";
    };
    readonly clean_summary: {
        readonly method: "get_clean_summary";
    };
    readonly miIO_info: {
        readonly method: "miIO.info";
    };
    readonly clean_record: {
        readonly method: "get_clean_record";
    };
    readonly filter_reset: {
        readonly method: "reset_consumable";
        readonly params: "filter_work_time";
    };
    readonly sensors_reset: {
        readonly method: "reset_consumable";
        readonly params: "sensor_dirty_time";
    };
    readonly main_brush_reset: {
        readonly method: "reset_consumable";
        readonly params: "main_brush_work_time";
    };
    readonly mop_pad_reset: {
        readonly method: "reset_consumable";
        readonly params: "mop_pad_work_time";
    };
    readonly side_brush_reset: {
        readonly method: "reset_consumable";
        readonly params: "side_brush_work_time";
    };
    readonly water_filter_reset: {
        readonly method: "reset_consumable";
        readonly params: "filter_element_work_time";
    };
    readonly strainer_reset: {
        readonly method: "reset_consumable";
        readonly params: "strainer_work_times";
    };
    readonly cleaner_filter_reset: {
        readonly method: "reset_consumable";
        readonly params: "cleaning_brush_work_times";
    };
    readonly dust_collection_reset: {
        readonly method: "reset_consumable";
        readonly params: "dust_collection_work_times";
    };
    readonly spotclean: {
        readonly method: "app_spot";
    };
    readonly resumeZoneClean: {
        readonly method: "resume_zoned_clean";
    };
    readonly resumeRoomClean: {
        readonly method: "resume_segment_clean";
    };
    readonly loadRooms: {
        readonly method: "get_room_mapping";
    };
    readonly loadMap: {
        readonly method: "get_map_v1";
    };
    readonly startDustCollect: {
        readonly method: "app_start_collect_dust";
    };
    readonly stopDustCollect: {
        readonly method: "app_stop_collect_dust";
    };
    readonly startWashMop: {
        readonly method: "app_start_wash";
    };
    readonly stopWashMop: {
        readonly method: "app_stop_wash";
    };
};
export = commands;

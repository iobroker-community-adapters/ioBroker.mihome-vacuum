module.exports = {
	find: {
		method: "find_me",
	},
	start: {
		method: "app_start",
	},
	pause: {
		method: "app_pause",
	},
	home: {
		method: "app_charge",
	},
	get_status: {
		method: "get_status",
	},
	get_consumable: {
		method: "get_consumable",
	},
	get_carpet_mode: {
		method: "get_carpet_mode",
	},
	get_sound_volume: {
		method: "get_sound_volume",
	},
	sound_volume: {
		method: "change_sound_volume",
	},
	sound_volume_test: {
		method: "test_sound_volume",
	},
	fan_power: {
		method: "set_custom_mode",
	},
	mop_mode: {
		method: "set_mop_mode",
	},
	water_box_mode: {
		method: "set_water_box_custom_mode",
	},
	clean_summary: {
		method: "get_clean_summary",
	},
	miIO_info: {
		method: "miIO.info",
	},
	clean_record: {
		method: "get_clean_record",
	},
	filter_reset: {
		method: "reset_consumable",
		params: "filter_work_time",
	},
	sensors_reset: {
		method: "reset_consumable",
		params: "sensor_dirty_time",
	},
	main_brush_reset: {
		method: "reset_consumable",
		params: "main_brush_work_time",
	},
	side_brush_reset: {
		method: "reset_consumable",
		params: "side_brush_work_time",
	},
	water_filter_reset: {
		method: "reset_consumable",
		params: "filter_element_work_time",
	},
	strainer_reset: {
		method: "reset_consumable",
		params: "strainer_work_times",
	},
	cleaner_filter_reset: {
		method: "reset_consumable",
		params: "cleaning_brush_work_times",
	},
	dust_collection_reset: {
		method: "reset_consumable",
		params: "dust_collection_work_times",

	},
	spotclean: {
		method: "app_spot",
	},
	resumeZoneClean: {
		method: "resume_zoned_clean",
	},
	resumeRoomClean: {
		method: "resume_segment_clean",
	},
	loadRooms: {
		method: "get_room_mapping",
	},
	loadMap: {
		method: "get_map_v1",
	},
	startDustCollect: {
		method: "app_start_collect_dust",
	},
	stopDustCollect: {
		method: "app_stop_collect_dust",
	},
	startWashMop: {
		method: "app_start_wash",
	},
	stopWashMop: {
		method: "app_stop_wash",
	},
};
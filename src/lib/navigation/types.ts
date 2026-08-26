/**
 * Client-safe navigation domain model.
 *
 * Nothing here imports a provider SDK: the UI only ever speaks this shape, so
 * openrouteservice / Nominatim / VROOM can be swapped for self-hosted OSRM,
 * Valhalla or GraphHopper without touching a component.
 */

export type Lang = "ar" | "en";

export type TravelMode = "driving" | "walking" | "cycling" | "delivery" | "heavy";

export const TRAVEL_MODES: { value: TravelMode; ar: string; en: string }[] = [
  { value: "driving", ar: "سيارة", en: "Driving" },
  { value: "walking", ar: "مشياً", en: "Walking" },
  { value: "cycling", ar: "دراجة", en: "Cycling" },
  { value: "delivery", ar: "مركبة توصيل", en: "Delivery vehicle" },
  { value: "heavy", ar: "مركبة ثقيلة", en: "Heavy vehicle" },
];

export const TRAVEL_MODE_LABELS: Record<TravelMode, { ar: string; en: string }> =
  Object.fromEntries(TRAVEL_MODES.map((m) => [m.value, { ar: m.ar, en: m.en }])) as Record<
    TravelMode,
    { ar: string; en: string }
  >;

export type Coordinates = { latitude: number; longitude: number };

/** Why a particular point was chosen as the routing destination. */
export type DestinationKind =
  | "user_selected_entrance"
  | "mode_preferred_entrance"
  | "delivery_entrance"
  | "road_access_point"
  | "parking_point"
  | "main_entrance"
  | "property_centroid";

export const DESTINATION_KIND_LABELS: Record<DestinationKind, { ar: string; en: string }> = {
  user_selected_entrance: { ar: "مدخل اخترته", en: "Entrance you selected" },
  mode_preferred_entrance: { ar: "المدخل المفضل لنمط التنقل", en: "Preferred entrance for this mode" },
  delivery_entrance: { ar: "مدخل التوصيل", en: "Delivery entrance" },
  road_access_point: { ar: "نقطة الوصول الطرقية", en: "Road access point" },
  parking_point: { ar: "نقطة الوقوف / المواقف", en: "Parking / stopping point" },
  main_entrance: { ar: "المدخل الرئيسي", en: "Main entrance" },
  property_centroid: { ar: "إحداثيات العقار (احتياطي)", en: "Property coordinates (fallback)" },
};

export type OriginMethod =
  | "current_location"
  | "smart_address"
  | "business"
  | "saved_address"
  | "map_pin"
  | "coordinates"
  | "recent";

export type NavDestination = {
  smart_code: string;
  property_name: string;
  city: string | null;
  neighborhood: string | null;
  /** The point the route actually ends at. */
  point: Coordinates;
  kind: DestinationKind;
  /** Human label of the chosen destination point. */
  point_label_ar: string;
  point_label_en: string | null;
  entrance_id: string | null;
  node_id: string;
  /** Property centre — used for the dashed last-metre segment and map framing. */
  property_point: Coordinates | null;
  /** True when routing stops at a road access point rather than the entrance. */
  final_leg_on_foot: boolean;
  final_leg_meters: number | null;
  warnings: NavWarning[];
};

export type NavEntranceOption = {
  id: string;
  display_name: string;
  access_type: string;
  latitude: number | null;
  longitude: number | null;
  is_primary: boolean;
  is_delivery_entrance: boolean;
  is_parking_entrance: boolean;
  is_emergency_entrance: boolean;
  is_loading_entrance: boolean;
  wheelchair_accessible: boolean;
  vehicle_access: boolean;
  temporarily_closed: boolean;
  temporary_status: string | null;
  status_reason: string | null;
  photo_url: string | null;
  instructions_ar: string | null;
  instructions_en: string | null;
  confidence_score: number;
  verification_level: string;
};

export type NavRoadAccessPoint = {
  id: string;
  latitude: number;
  longitude: number;
  access_type: string;
  stopping_allowed: boolean;
  parking_available: boolean;
  road_name: string | null;
  approach_direction: string | null;
  notes_ar: string | null;
  notes_en: string | null;
  vehicle_types: string[];
  verification_status: string;
};

export type LastMetreCard = {
  building_name: string | null;
  entrance_name: string | null;
  entrance_photo: string | null;
  landmark: string | null;
  door_description: string | null;
  floor: string | null;
  unit_number: string | null;
  intercom_name: string | null;
  elevator_available: boolean | null;
  stairs_required: boolean | null;
  accessibility_notes: string | null;
  call_on_arrival: boolean;
  instruction_text: string | null;
  /** Only ever populated for an authorised viewer (owner or valid private link). */
  delivery_notes: string | null;
  private_fields_visible: boolean;
};

export type ManoeuvreType =
  | "depart"
  | "arrive"
  | "straight"
  | "turn_left"
  | "turn_right"
  | "turn_slight_left"
  | "turn_slight_right"
  | "turn_sharp_left"
  | "turn_sharp_right"
  | "uturn"
  | "roundabout"
  | "keep_left"
  | "keep_right"
  | "merge"
  | "ramp"
  | "unknown";

export type RouteStep = {
  index: number;
  manoeuvre: ManoeuvreType;
  road_name: string | null;
  distance_m: number;
  duration_s: number;
  exit_number: number | null;
  /** Index range into the route geometry. */
  way_points: [number, number] | null;
};

export type NavWarning =
  | "unverified_road_data"
  | "stale_address_data"
  | "entrance_temporarily_closed"
  | "entrance_not_on_road_network"
  | "approximate_route"
  | "low_confidence_address";

export const WARNING_LABELS: Record<NavWarning, { ar: string; en: string }> = {
  unverified_road_data: {
    ar: "بيانات الطرق في هذه المنطقة غير موثقة بالكامل.",
    en: "Road data in this area is not fully verified.",
  },
  stale_address_data: {
    ar: "لم يُحدَّث هذا العنوان منذ فترة طويلة.",
    en: "This address has not been updated in a long time.",
  },
  entrance_temporarily_closed: {
    ar: "المدخل المحدد مغلق مؤقتاً — تم اختيار بديل.",
    en: "The selected entrance is temporarily closed — an alternative was used.",
  },
  entrance_not_on_road_network: {
    ar: "المدخل غير متصل بشبكة الطرق؛ ينتهي المسار عند نقطة الوصول الطرقية.",
    en: "The entrance is not on the road network; the route ends at the road access point.",
  },
  approximate_route: {
    ar: "المسار تقريبي وقد لا يعكس الواقع على الأرض.",
    en: "This route is approximate and may not reflect conditions on the ground.",
  },
  low_confidence_address: {
    ar: "درجة الثقة في هذا العنوان منخفضة.",
    en: "Confidence in this address is low.",
  },
};

export type RouteResult = {
  /** Encoded polyline (precision 5) — compact for low-bandwidth transfer. */
  geometry: string;
  distance_m: number;
  duration_s: number;
  steps: RouteStep[];
  warnings: NavWarning[];
  provider: string;
  provider_attribution: string;
  generated_at: string;
  travel_mode: TravelMode;
  is_alternative: boolean;
};

export type RouteBundle = {
  primary: RouteResult;
  alternatives: RouteResult[];
};

export type NavErrorCode =
  | "no_route_found"
  | "origin_unavailable"
  | "destination_unavailable"
  | "entrance_unavailable"
  | "routing_service_unavailable"
  | "routing_not_configured"
  | "rate_limited"
  | "offline";

export const NAV_ERROR_LABELS: Record<NavErrorCode, { ar: string; en: string }> = {
  no_route_found: { ar: "لم يُعثر على مسار صالح.", en: "No route could be found." },
  origin_unavailable: { ar: "نقطة الانطلاق غير متاحة.", en: "The origin is unavailable." },
  destination_unavailable: { ar: "الوجهة غير متاحة.", en: "The destination is unavailable." },
  entrance_unavailable: { ar: "المدخل غير متاح حالياً.", en: "This entrance is unavailable." },
  routing_service_unavailable: {
    ar: "خدمة التوجيه غير متاحة مؤقتاً. حاول لاحقاً.",
    en: "The routing service is temporarily unavailable. Try again later.",
  },
  routing_not_configured: {
    ar: "خدمة التوجيه غير مُعدّة بعد على الخادم.",
    en: "The routing service is not configured on the server yet.",
  },
  rate_limited: {
    ar: "طلبات كثيرة جداً. انتظر قليلاً ثم أعد المحاولة.",
    en: "Too many requests. Please wait and retry.",
  },
  offline: { ar: "لا يوجد اتصال بالإنترنت.", en: "You are offline." },
};

export const ROUTE_REPORT_CATEGORIES = [
  { value: "road_closed", ar: "الطريق مغلق", en: "Road closed" },
  { value: "road_missing", ar: "الطريق غير موجود", en: "Road does not exist" },
  { value: "wrong_oneway", ar: "اتجاه وحيد خاطئ", en: "Incorrect one-way direction" },
  { value: "unsafe", ar: "الطريق غير آمن", en: "Route unsafe" },
  { value: "entrance_inaccessible", ar: "المدخل غير قابل للوصول", en: "Entrance inaccessible" },
  { value: "wrong_entrance", ar: "المدخل خاطئ", en: "Wrong entrance" },
  { value: "delivery_entrance_closed", ar: "مدخل التوصيل مغلق", en: "Delivery entrance closed" },
  { value: "unsuitable_vehicle", ar: "الطريق لا يناسب المركبة", en: "Road unsuitable for vehicle" },
  { value: "wrong_map_location", ar: "الموقع على الخريطة خاطئ", en: "Map location incorrect" },
  { value: "new_road", ar: "طريق جديد", en: "New road" },
  { value: "temporary_obstruction", ar: "عائق مؤقت", en: "Temporary obstruction" },
] as const;

export type RouteReportCategory = (typeof ROUTE_REPORT_CATEGORIES)[number]["value"];

export const ENTRANCE_KIND_LABELS: Record<string, { ar: string; en: string }> = {
  main_entrance: { ar: "مدخل رئيسي", en: "Main entrance" },
  delivery_entrance: { ar: "مدخل توصيل", en: "Delivery entrance" },
  pedestrian_entrance: { ar: "مدخل مشاة", en: "Pedestrian entrance" },
  parking_entrance: { ar: "مدخل مواقف", en: "Parking entrance" },
  loading_entrance: { ar: "مدخل تحميل", en: "Loading entrance" },
  emergency_entrance: { ar: "مدخل طوارئ", en: "Emergency entrance" },
  service_entrance: { ar: "مدخل خدمات", en: "Service entrance" },
  private_entrance: { ar: "مدخل خاص", en: "Private entrance" },
  temporarily_closed: { ar: "مدخل مغلق مؤقتاً", en: "Temporarily closed entrance" },
};

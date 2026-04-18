<?php
/**
 * top_venues_by_users_and_bandwidth.php
 *
 * AJAX endpoint — returns ECharts-compatible JSON for the
 * "Top Venues by Users & Data Consumption" grouped bar chart.
 *
 * Expected POST/GET params:
 *   dateFrom        e.g. "2025-03-01"
 *   dateTo          e.g. "2025-03-31"
 *   usermode        "signup" | "login" | "online"  (default: signup)
 *   search_location (optional) pre-built AND fragment e.g. "AND lus.location_id IN (1,2,3)"
 *   reporttype      1 = date-wise  |  2 = network/location-wise  (default: 2)
 */

session_start();
header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store');

/* ── Includes ──────────────────────────────────────────────────────────────── */
require('../../../include/constants.php');
require('../../../include/checkdata.php');
require('../../../include/dbinfo.php');
require('../../../include/utils.php');
require('../../../include/config.php');

/* ── Helper: emit error JSON and exit ─────────────────────────────────────── */
function jsonError($msg) {
    echo json_encode(['status' => 'error', 'message' => $msg]);
    exit;
}

/* ── Helper: bytes → human-readable string (mirrors JS convertToDisplayBytes) */
function convertToDisplayBytes($bytes) {
    $bytes = (float)$bytes;
    if ($bytes <= 0)               return '0 Bytes';
    if ($bytes >= 1099511600000)   return round($bytes / 1099511600000, 1) . ' TB';
    if ($bytes >= 1073741824)      return round($bytes / 1073741824,    2) . ' GB';
    if ($bytes >= 1048576)         return round($bytes / 1048576,       1) . ' MB';
    if ($bytes >= 1024)            return round($bytes / 1024,          1) . ' KB';
    return $bytes . ' Bytes';
}

/* ── Input sanitisation ────────────────────────────────────────────────────── */
$customerid = (int)$_SESSION['customerid'];
$dateFrom   = isset($_REQUEST['dateFrom'])   ? $_REQUEST['dateFrom']   : '';
$dateTo     = isset($_REQUEST['dateTo'])     ? $_REQUEST['dateTo']     : '';
$usermode   = isset($_REQUEST['usermode'])   ? strtolower(trim($_REQUEST['usermode'])) : 'signup';
$reporttype = isset($_REQUEST['reporttype']) ? (int)$_REQUEST['reporttype'] : 2;

/* Timezone names from config/session (same as reference query) */
$servertimezonename = isset($servertimezonename) ? $servertimezonename : 'UTC';
$timezonename       = isset($_SESSION['timezonename']) ? $_SESSION['timezonename'] : 'UTC';

if (!in_array($usermode, ['signup', 'login', 'online'])) {
    $usermode = 'signup';
}

if (!$dateFrom || !$dateTo) {
    jsonError('dateFrom and dateTo are required.');
}

$dateFrom = date('Y-m-d', strtotime($dateFrom));
$dateTo   = date('Y-m-d', strtotime($dateTo));

if ($dateFrom > $dateTo) {
    jsonError('dateFrom must not be after dateTo.');
}

/* ── DB connection ─────────────────────────────────────────────────────────── */
$dblink = @mysql_pconnect("$report_server:$report_port", $report_username, $report_password);
if (!$dblink) {
    jsonError('Database connection failed.');
}

/* ── Location / group filter ───────────────────────────────────────────────── */
/*
 * Reference query uses alias "locationid" for uc_oldev_net_virtual_log
 * and "l.id" for user queries.
 * We derive both from the incoming search_location fragment.
 */
if (!empty($_REQUEST['search_location'])) {
    $rawFragment = $_REQUEST['search_location'];

    // Bandwidth query: uc_oldev_net_virtual_log uses column "locationid" (no alias prefix)
    $locationConditionBW   = str_replace('lus.location_id', 'v.locationid', $rawFragment);

    // User queries: location table alias l.id
    $locationConditionUser = str_replace('lus.location_id', 'l.id', $rawFragment);
} else {
    // Fall back to group-id helper — pass the correct column alias per query
    $locationConditionBW   = getLocationIdFromGroupId('v.locationid');
    $locationConditionUser = getLocationIdFromGroupId('l.id');
}

/* ══════════════════════════════════════════════════════════════════════════════
   STEP 1 — Top 5 venues by USER count
   ══════════════════════════════════════════════════════════════════════════════ */

if ($usermode === 'signup') {
    /* ── Signup count per venue ──────────────────────────────────────────────── */
    $query_users = "
        SELECT
            l.id                 AS locationid,
            l.locationname       AS locationname,
            v.venuename          AS venuename,
            IFNULL(da.signup, 0) AS usercount
        FROM location l
        JOIN venue v ON v.id = l.venueid
        LEFT JOIN (
            SELECT location_id, COUNT(createddate) AS signup
            FROM user u
            WHERE DATE(createddate) BETWEEN '$dateFrom' AND '$dateTo'
              AND u.customer_id = $customerid
            GROUP BY location_id
        ) da ON l.id = da.location_id
        WHERE l.customerid = $customerid
          $locationConditionUser
        GROUP BY v.venuename, l.id, l.locationname
        ORDER BY usercount DESC
        LIMIT 5";

} elseif ($usermode === 'login') {
    /* ── Login (unique users) count per venue ───────────────────────────────── */
    $query_users = "
        SELECT
            l.id                  AS locationid,
            l.locationname        AS locationname,
            v.venuename           AS venuename,
            IFNULL(da.logins, 0)  AS usercount
        FROM location l
        JOIN venue v ON v.id = l.venueid
        LEFT JOIN (
            SELECT location_id, COUNT(DISTINCT user_id) AS logins
            FROM radius.radius_accounting
            WHERE sessionstarttime BETWEEN '$dateFrom' AND '$dateTo'
              AND customer_id = $customerid
            GROUP BY location_id
        ) da ON l.id = da.location_id
        WHERE l.customerid = $customerid
          $locationConditionUser
        ORDER BY usercount DESC
        LIMIT 5";

} else {
    /* ── Online clients (currently active) per venue ────────────────────────── */
    $query_users = "
        SELECT
            l.id            AS locationid,
            l.locationname  AS locationname,
            v.venuename     AS venuename,
            COUNT(DISTINCT c.ClientMacAddress) AS usercount
        FROM venue v
        JOIN location l ON l.venueid = v.id
        LEFT JOIN (
            SELECT c.locationid, c.ClientMacAddress
            FROM uc_client c
            JOIN (
                SELECT DISTINCT local_time
                FROM uc_device_status
                WHERE customerid = $customerid
                  AND status = 1
                  AND local_time > 0
            ) t ON c.ApLocalTime = t.local_time
            WHERE c.customerid = $customerid
        ) c ON l.id = c.locationid
        WHERE v.customerid = $customerid
          $locationConditionUser
        GROUP BY v.venuename, l.id, l.locationname
        ORDER BY usercount DESC
        LIMIT 5";
}

file_put_contents('/tmp/radius_reports.log', "\n\nquery_users => " . $query_users, FILE_APPEND);

$result_users = mysql_db_query($report_database, $query_users, $dblink);
if (!$result_users) {
    jsonError('User query failed: ' . mysql_error());
}

/* ── Collect top-5 venue ids and names ─────────────────────────────────────── */
$venueNames  = [];
$locationIds = [];
$userCounts  = [];

while ($row = mysql_fetch_assoc($result_users)) {
    $venueNames[]  = $row['venuename'] ?: $row['locationname'];
    $locationIds[] = (int)$row['locationid'];
    $userCounts[]  = (int)$row['usercount'];
}

if (empty($locationIds)) {
    echo json_encode([
        'status' => 'success',
        'data'   => [
            'xAxisData'     => [],
            'labelXaxis'    => 'Venue',
            'labelYaxis'    => 'Data',
            'labelYaxis2'   => 'Users',
            'unit'          => 'Bytes',
            'hasData'       => false,
            'tooltipExtras' => [],
            'series'        => [],
        ]
    ]);
    exit;
}

/* ══════════════════════════════════════════════════════════════════════════════
   STEP 2 — Bandwidth for the same top-5 location IDs
   ─────────────────────────────────────────────────────────────────────────────
   Source table : uc_oldev_net_virtual_log  (matches reference dashboard query)
   Download     : SUM(delta_rx_bytes)
   Upload       : SUM(delta_tx_bytes)
   Filter       : name LIKE 'up%'  (reference condition — keeps uplink interfaces)
   Date filter  : CONVERT_TZ timestamp to customer timezone  (mirrors reference)
   ══════════════════════════════════════════════════════════════════════════════ */

$idList = implode(',', $locationIds);

/*
 * Date range version of the reference query:
 * Reference used CURDATE() for a dashboard widget (today only).
 * Here we honour dateFrom/dateTo so the chart respects the page's date filter.
 * CONVERT_TZ keeps timezone handling consistent with the reference.
 */
$query_bw = "
    SELECT
        v.locationid                    AS locationid,
        l.LocationDisName               AS locationname,
        SUM(v.delta_rx_bytes)           AS total_download,
        SUM(v.delta_tx_bytes)           AS total_upload
    FROM uc_oldev_net_virtual_log v
    LEFT JOIN location l ON v.locationid = l.id
    WHERE v.customerid = $customerid
      AND v.name LIKE 'up%'
      AND DATE(CONVERT_TZ(v.timestamp, '$servertimezonename', '$timezonename'))
          BETWEEN '$dateFrom' AND '$dateTo'
      AND v.locationid IN ($idList)
    GROUP BY v.locationid, l.LocationDisName";

file_put_contents('/tmp/radius_reports.log', "\n\nquery_bw => " . $query_bw, FILE_APPEND);

$result_bw = mysql_db_query($report_database, $query_bw, $dblink);
if (!$result_bw) {
    jsonError('Bandwidth query failed: ' . mysql_error());
}

/* ── Index bandwidth by location_id ────────────────────────────────────────── */
$bwByLocation = [];
while ($row = mysql_fetch_assoc($result_bw)) {
    $bwByLocation[(int)$row['locationid']] = [
        'download' => (float)$row['total_download'],
        'upload'   => (float)$row['total_upload'],
    ];
}

@mysql_close($dblink);

/* ══════════════════════════════════════════════════════════════════════════════
   STEP 3 — Build series arrays + tooltipExtras
   ══════════════════════════════════════════════════════════════════════════════ */

$downloadData   = [];
$uploadData     = [];
$downloadLabels = [];
$uploadLabels   = [];
$tooltipExtras  = [];
$hasData        = false;

foreach ($locationIds as $i => $locId) {
    $dl = isset($bwByLocation[$locId]) ? $bwByLocation[$locId]['download'] : 0;
    $ul = isset($bwByLocation[$locId]) ? $bwByLocation[$locId]['upload']   : 0;
    $bw = $dl + $ul;

    $downloadData[]   = $dl;
    $uploadData[]     = $ul;
    $downloadLabels[] = convertToDisplayBytes($dl);
    $uploadLabels[]   = convertToDisplayBytes($ul);

    $tooltipExtras[] = [
        'venue'     => $venueNames[$i],
        'users'     => $userCounts[$i],
        'download'  => convertToDisplayBytes($dl),
        'upload'    => convertToDisplayBytes($ul),
        'bandwidth' => convertToDisplayBytes($bw),
    ];

    if ($userCounts[$i] > 0 || $dl > 0 || $ul > 0) {
        $hasData = true;
    }
}

/* ── User series label ─────────────────────────────────────────────────────── */
$userSeriesLabel = [
    'signup' => 'Signups',
    'login'  => 'Logins',
    'online' => 'Online Users',
][$usermode];

/* ── Build series ──────────────────────────────────────────────────────────── */
$series = [
    /* Series 0: Users — right Y-axis (yAxisIndex 1) */
    [
        'name'        => $userSeriesLabel,
        'type'        => 'bar',
        'barMaxWidth' => 50,
        'yAxisIndex'  => 1,
        'data'        => $userCounts,
        'itemStyle'   => ['color' => '#5CB85C'],
        'label'       => ['show' => false],
        'emphasis'    => ['focus' => 'series'],
    ],
    /* Series 1: Download — left Y-axis (yAxisIndex 0), raw bytes + formatted labels */
    [
        'name'          => 'Download',
        'type'          => 'bar',
        'barMaxWidth'   => 50,
        'yAxisIndex'    => 0,
        'data'          => $downloadData,
        'displayLabels' => $downloadLabels,
        'itemStyle'     => ['color' => '#4E8FE8'],
        'label'         => ['show' => false],
        'emphasis'      => ['focus' => 'series'],
    ],
    /* Series 2: Upload — left Y-axis (yAxisIndex 0), raw bytes + formatted labels */
    [
        'name'          => 'Upload',
        'type'          => 'bar',
        'barMaxWidth'   => 50,
        'yAxisIndex'    => 0,
        'data'          => $uploadData,
        'displayLabels' => $uploadLabels,
        'itemStyle'     => ['color' => '#F5A623'],
        'label'         => ['show' => false],
        'emphasis'      => ['focus' => 'series'],
    ],
];

/* ── Final response ────────────────────────────────────────────────────────── */
$response = [
    'status' => 'success',
    'data'   => [
        'xAxisData'     => $venueNames,
        'labelXaxis'    => 'Venue',
        'labelYaxis'    => 'Data',
        'labelYaxis2'   => 'Users',
        'unit'          => 'Bytes',
        'hasData'       => $hasData,
        'tooltipExtras' => $tooltipExtras,
        'usermode'      => $usermode,
        'series'        => $series,
    ],
];

echo json_encode($response);

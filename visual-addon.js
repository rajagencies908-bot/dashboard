/* =========================================================
   RAJ AGENCIES - visual-addon.js - online47

   GRAPH VIEW
   ---------------------------------------------------------
   DEFAULT:
   - Normal View
   - Original graph behaviour
   - Main dashboard Month/filter applies

   OPTIONAL:
   - Month Wise View
   - User chooses this manually
   - Multi Month selection
   - Select All / Unselect All
   - April + August etc. possible
   - Separate month bars

   INDIA MAP
   ---------------------------------------------------------
   - Kept
   - All Pincodes
   - Click Pincode details
   - Uses main dashboard filters/month
========================================================= */

(() => {

  'use strict';

  const PINCODE_COORDS_URL =
    'https://raw.githubusercontent.com/mrparveensharma/All-India-Pincode-list-with-latitude-and-longitude/refs/heads/master/Minimal-India-Pincode-list-with-latitude-and-longitude.csv';

  const VIEW_NAMES = {
    Party: 'Customer Wise',
    MainGrp: 'Company Wise',
    ItemName: 'Product Wise',
    SM: 'SM Wise',
    Division: 'Division Wise',
    Area: 'Area Wise',
    City: 'City Wise',
    Pincode: 'Pincode Wise'
  };

  const METRIC_NAMES = {
    taxable: 'Taxable Sales',
    qty: 'Quantity',
    customers: 'Customers Billed',
    products: 'Products Sold',
    records: 'Records'
  };

  const MONTH_COLORS = [
    '#6757f5',
    '#3b82f6',
    '#14b8a6',
    '#22c55e',
    '#f59e0b',
    '#ef4444',
    '#ec4899',
    '#8b5cf6',
    '#06b6d4',
    '#84cc16',
    '#f97316',
    '#6366f1'
  ];

  const NORMAL_COLORS = [
    '#6757f5',
    '#7c63f4',
    '#9168ef',
    '#a66de9',
    '#bb72df',
    '#4f86ef',
    '#36a2eb',
    '#32b9a5',
    '#45bf75',
    '#f0a23a',
    '#ef6f61',
    '#e65c8a',
    '#bd67d5',
    '#8c72df',
    '#6578d8'
  ];

  let salesChart = null;
  let indiaMap = null;
  let mapLayer = null;
  let pinLookup = null;

  let graphRequestId = 0;

  let graphMode = 'normal';

  /*
     online47 FIX:
     Empty array can now mean the user intentionally
     selected NO months.

     graphMonthsInitialized tells us whether initial
     month selection has already happened.
  */
  let graphMonthsInitialized = false;
  let selectedGraphMonths = [];

  let graphMonthSchemaKey = '';


  const $ = id =>
    document.getElementById(id);


  /* =====================================================
     BASIC HELPERS
  ===================================================== */

  function number(value) {

    const n = Number(value || 0);

    return Number.isFinite(n)
      ? n
      : 0;

  }


  function indian(value, digits = 0) {

    return new Intl.NumberFormat(
      'en-IN',
      {
        maximumFractionDigits: digits
      }
    ).format(
      number(value)
    );

  }


  function rupees(value) {

    return '₹' +
      new Intl.NumberFormat(
        'en-IN',
        {
          maximumFractionDigits: 0
        }
      ).format(
        number(value)
      );

  }


  function compact(value) {

    const n =
      Math.abs(
        number(value)
      );

    if (n >= 10000000) {

      return (
        number(value) / 10000000
      ).toFixed(1) + ' Cr';

    }

    if (n >= 100000) {

      return (
        number(value) / 100000
      ).toFixed(1) + ' L';

    }

    if (n >= 1000) {

      return (
        number(value) / 1000
      ).toFixed(1) + ' K';

    }

    return indian(value);

  }


  function escapeHtml(value) {

    const div =
      document.createElement('div');

    div.textContent =
      String(value ?? '');

    return div.innerHTML;

  }


  function visualMonthName(month) {

    if (
      typeof monthNames !== 'undefined'
      &&
      monthNames
      &&
      monthNames[month]
    ) {

      return monthNames[month];

    }

    return month;

  }


  function metricValue(row, metric) {

    if (metric === 'customers') {

      return number(
        row.customersBilled
        ??
        row.customersbilled
      );

    }

    if (metric === 'products') {

      return number(
        row.productsSold
        ??
        row.productssold
      );

    }

    return number(
      row[metric]
    );

  }


  function metricText(value, metric) {

    if (metric === 'taxable') {

      return rupees(value);

    }

    return indian(
      value,
      metric === 'qty'
        ? 2
        : 0
    );

  }


  function availableMonths() {

    if (
      typeof months !== 'undefined'
      &&
      Array.isArray(months)
    ) {

      return [...months];

    }

    return [];

  }


  function dashboardMonths() {

    if (
      typeof selected !== 'undefined'
      &&
      Array.isArray(selected.month)
    ) {

      return [...selected.month];

    }

    return [];

  }


  function currentMetric() {

    return $('visualMetric')
      ?.value
      ||
      'taxable';

  }


  function currentTopN() {

    return Number(
      $('visualTopN')
        ?.value
      ||
      10
    );

  }


  function currentChartType() {

    return $('visualChartType')
      ?.value
      ||
      'bar';

  }


  /* =====================================================
     ONLINE47 MONTH DROPDOWN STYLE
     Kept inside this JS so visual-style.css does not
     need to be changed for this update.
  ===================================================== */

  function installGraphMonthStyles() {

    if ($('visualGraphMonthOnline47Style')) {
      return;
    }

    const style =
      document.createElement('style');

    style.id =
      'visualGraphMonthOnline47Style';

    style.textContent = `

      #visualGraphMonthsField {
        position: relative !important;
        min-width: 220px;
      }

      #visualGraphMonthsButton {
        width: 100% !important;
        min-height: 48px !important;
        padding: 0 14px !important;
        border: 1px solid rgba(125, 117, 170, .22) !important;
        border-radius: 14px !important;
        background: rgba(255, 255, 255, .96) !important;
        color: #1f2937 !important;
        text-align: left !important;
        cursor: pointer !important;
        font: inherit !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 10px !important;
        box-sizing: border-box !important;
        box-shadow:
          0 2px 8px rgba(31, 41, 55, .04) !important;
      }

      #visualGraphMonthsButton:hover {
        border-color: rgba(103, 87, 245, .42) !important;
      }

      #visualGraphMonthsButton:focus {
        outline: none !important;
        border-color: #6757f5 !important;
        box-shadow:
          0 0 0 3px rgba(103, 87, 245, .12) !important;
      }

      #visualGraphMonthsText {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
        min-width: 0;
      }

      .visual-month-arrow {
        flex: 0 0 auto;
        font-size: 16px;
        color: #6b7280;
        transition: transform .18s ease;
      }

      #visualGraphMonthsButton[aria-expanded="true"]
      .visual-month-arrow {
        transform: rotate(180deg);
      }

      #visualGraphMonthsMenu {
        display: none;
        position: absolute !important;
        top: calc(100% + 8px) !important;
        left: 0 !important;
        width: 310px !important;
        max-width: calc(100vw - 24px) !important;
        z-index: 999999 !important;
        padding: 12px !important;
        box-sizing: border-box !important;
        border:
          1px solid rgba(117, 108, 170, .20) !important;
        border-radius: 16px !important;
        background:
          rgba(255, 255, 255, .99) !important;
        box-shadow:
          0 18px 45px rgba(44, 36, 90, .18) !important;
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
      }

      #visualGraphMonthsMenu.open {
        display: block !important;
      }

      .visual-month-search-wrap {
        margin-bottom: 10px;
      }

      #visualGraphMonthsSearch {
        display: block !important;
        width: 100% !important;
        height: 44px !important;
        min-height: 44px !important;
        box-sizing: border-box !important;
        padding: 0 13px !important;
        margin: 0 !important;
        border:
          1px solid #dedfea !important;
        border-radius: 12px !important;
        background: #ffffff !important;
        color: #252938 !important;
        font: inherit !important;
        font-size: 14px !important;
        box-shadow: none !important;
      }

      #visualGraphMonthsSearch::placeholder {
        color: #9ca3af !important;
      }

      #visualGraphMonthsSearch:focus {
        outline: none !important;
        border-color: #6757f5 !important;
        box-shadow:
          0 0 0 3px rgba(103, 87, 245, .11) !important;
      }

      .visual-month-actions {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 8px !important;
        padding-bottom: 10px !important;
        margin-bottom: 6px !important;
        border-bottom:
          1px solid rgba(125, 117, 170, .14) !important;
      }

      #visualGraphMonthsAll,
      #visualGraphMonthsNone {
        width: 100% !important;
        min-height: 38px !important;
        margin: 0 !important;
        padding: 7px 10px !important;
        border-radius: 10px !important;
        cursor: pointer !important;
        font: inherit !important;
        font-size: 13px !important;
        font-weight: 700 !important;
        line-height: 1.2 !important;
        box-shadow: none !important;
        transform: none !important;
      }

      #visualGraphMonthsAll {
        border: 1px solid #6757f5 !important;
        background: #6757f5 !important;
        color: #ffffff !important;
      }

      #visualGraphMonthsAll:hover {
        filter: brightness(.97);
      }

      #visualGraphMonthsNone {
        border: 1px solid #dedfea !important;
        background: #ffffff !important;
        color: #4b5563 !important;
      }

      #visualGraphMonthsNone:hover {
        border-color: #bbb7dc !important;
        background: #faf9ff !important;
      }

      #visualGraphMonthsOptions {
        max-height: 300px !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        padding: 3px 2px !important;
        scrollbar-width: thin;
      }

      #visualGraphMonthsOptions
      .visual-month-option {
        display: flex !important;
        align-items: center !important;
        gap: 11px !important;
        min-height: 42px !important;
        margin: 0 !important;
        padding: 7px 9px !important;
        box-sizing: border-box !important;
        border-radius: 10px !important;
        cursor: pointer !important;
        user-select: none !important;
        color: #343746 !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        line-height: 1.25 !important;
      }

      #visualGraphMonthsOptions
      .visual-month-option:hover {
        background: #f6f5ff !important;
      }

      #visualGraphMonthsOptions
      .visual-month-option.hidden {
        display: none !important;
      }

      /*
         Strongly scoped reset.
         Existing dashboard checkbox CSS must not turn
         these month checkboxes into large blue boxes.
      */
      #visualGraphMonthsMenu
      input.visual-month-check[type="checkbox"] {
        appearance: checkbox !important;
        -webkit-appearance: checkbox !important;
        width: 16px !important;
        height: 16px !important;
        min-width: 16px !important;
        max-width: 16px !important;
        min-height: 16px !important;
        max-height: 16px !important;
        flex: 0 0 16px !important;
        display: inline-block !important;
        margin: 0 !important;
        padding: 0 !important;
        border: initial !important;
        border-radius: 3px !important;
        background: initial !important;
        box-shadow: none !important;
        transform: none !important;
        opacity: 1 !important;
        position: static !important;
        cursor: pointer !important;
        vertical-align: middle !important;
      }

      #visualGraphMonthsMenu
      input.visual-month-check[type="checkbox"]::before,
      #visualGraphMonthsMenu
      input.visual-month-check[type="checkbox"]::after {
        content: none !important;
        display: none !important;
      }

      .visual-month-label {
        display: block;
        flex: 1;
        min-width: 0;
      }

      .visual-month-empty-search {
        display: none;
        padding: 18px 10px;
        text-align: center;
        color: #8b8fa3;
        font-size: 13px;
      }

      .visual-month-empty-search.show {
        display: block;
      }

      @media (max-width: 520px) {

        #visualGraphMonthsMenu {
          width: min(
            310px,
            calc(100vw - 28px)
          ) !important;
        }

      }

    `;

    document.head.appendChild(
      style
    );

  }


  /* =====================================================
     VISUAL GRAPH CONTROLS
  ===================================================== */

  function installGraphControls() {

    const controls =
      document.querySelector(
        '#graphVisualPane .visual-controls'
      );

    if (!controls) {
      return;
    }

    installGraphMonthStyles();

    /*
       Remove old single Graph Month control
       from online44 / online45.
    */
    $('visualGraphMonthField')
      ?.remove();


    if (!$('visualViewModeField')) {

      const modeField =
        document.createElement('div');

      modeField.id =
        'visualViewModeField';

      modeField.className =
        'field';

      modeField.innerHTML = `
        <label>View Mode</label>

        <select id="visualViewMode">

          <option value="normal" selected>
            Normal View
          </option>

          <option value="monthwise">
            Month Wise View
          </option>

        </select>
      `;

      controls.appendChild(
        modeField
      );

    }


    if (!$('visualGraphMonthsField')) {

      const monthField =
        document.createElement('div');

      monthField.id =
        'visualGraphMonthsField';

      monthField.className =
        'field';

      monthField.style.display =
        'none';

      monthField.innerHTML = `
        <label>Graph Months</label>

        <button
          type="button"
          id="visualGraphMonthsButton"
          aria-haspopup="true"
          aria-expanded="false"
        >
          <span id="visualGraphMonthsText">
            Select Months
          </span>

          <span
            class="visual-month-arrow"
            aria-hidden="true"
          >
            ⌄
          </span>
        </button>

        <div
          id="visualGraphMonthsMenu"
        >

          <div class="visual-month-search-wrap">

            <input
              type="text"
              id="visualGraphMonthsSearch"
              placeholder="Search month..."
              autocomplete="off"
              spellcheck="false"
            >

          </div>

          <div class="visual-month-actions">

            <button
              type="button"
              id="visualGraphMonthsAll"
            >
              Select All
            </button>

            <button
              type="button"
              id="visualGraphMonthsNone"
            >
              Unselect All
            </button>

          </div>

          <div
            id="visualGraphMonthsOptions"
          ></div>

          <div
            id="visualGraphMonthsEmptySearch"
            class="visual-month-empty-search"
          >
            No month found
          </div>

        </div>
      `;

      controls.appendChild(
        monthField
      );

    }


    populateMonthMultiSelect();

    updateGraphModeUI();

  }


  /*
     Synchronise month state without treating an
     intentionally empty selection as "not initialized".
  */
  function syncGraphMonthState() {

    const list =
      availableMonths();

    if (
      !graphMonthsInitialized
      &&
      list.length
    ) {

      selectedGraphMonths =
        [...list];

      graphMonthsInitialized =
        true;

    }

    else if (
      graphMonthsInitialized
    ) {

      selectedGraphMonths =
        selectedGraphMonths.filter(
          month =>
            list.includes(month)
        );

    }

    return list;

  }


  function populateMonthMultiSelect(
    force = false
  ) {

    const box =
      $('visualGraphMonthsOptions');

    if (!box) {
      return;
    }

    const list =
      syncGraphMonthState();

    const schemaKey =
      list.join('|');

    /*
       Do not rebuild DOM on every graph refresh.
       Rebuild only when schema/month list changes.
    */
    if (
      force
      ||
      graphMonthSchemaKey !== schemaKey
      ||
      !box.children.length
    ) {

      graphMonthSchemaKey =
        schemaKey;

      box.innerHTML = '';

      list.forEach(month => {

        const row =
          document.createElement('label');

        row.className =
          'visual-month-option';

        row.dataset.monthSearch =
          String(
            visualMonthName(month)
          ).toLowerCase();

        row.innerHTML = `
          <input
            class="visual-month-check"
            type="checkbox"
            value="${escapeHtml(month)}"
            ${
              selectedGraphMonths.includes(month)
                ? 'checked'
                : ''
            }
          >

          <span class="visual-month-label">
            ${escapeHtml(visualMonthName(month))}
          </span>
        `;

        box.appendChild(
          row
        );

      });

    }

    /*
       When DOM is not rebuilt, just sync checkbox states.
    */
    box
      .querySelectorAll(
        'input.visual-month-check[type="checkbox"]'
      )
      .forEach(input => {

        input.checked =
          selectedGraphMonths.includes(
            input.value
          );

      });

    updateMonthButtonText();

    filterGraphMonthOptions();

  }


  function updateMonthButtonText() {

    const text =
      $('visualGraphMonthsText');

    if (!text) {
      return;
    }

    const all =
      availableMonths();


    if (!selectedGraphMonths.length) {

      text.textContent =
        'No Month Selected';

      return;

    }


    if (
      all.length
      &&
      selectedGraphMonths.length === all.length
    ) {

      text.textContent =
        'All Months';

      return;

    }


    text.textContent =
      selectedGraphMonths
        .map(visualMonthName)
        .join(', ');

  }


  function filterGraphMonthOptions() {

    const search =
      $('visualGraphMonthsSearch');

    const box =
      $('visualGraphMonthsOptions');

    const empty =
      $('visualGraphMonthsEmptySearch');

    if (!box) {
      return;
    }

    const query =
      String(
        search?.value
        ??
        ''
      )
        .trim()
        .toLowerCase();

    let visibleCount = 0;

    box
      .querySelectorAll(
        '.visual-month-option'
      )
      .forEach(row => {

        const haystack =
          String(
            row.dataset.monthSearch
            ??
            row.textContent
            ??
            ''
          )
            .toLowerCase();

        const show =
          !query
          ||
          haystack.includes(query);

        row.classList.toggle(
          'hidden',
          !show
        );

        if (show) {
          visibleCount++;
        }

      });

    if (empty) {

      empty.classList.toggle(
        'show',
        Boolean(query)
        &&
        visibleCount === 0
      );

    }

  }


  function updateGraphModeUI() {

    const monthField =
      $('visualGraphMonthsField');

    if (monthField) {

      monthField.style.display =
        graphMode === 'monthwise'
          ? ''
          : 'none';

    }


    if ($('visualViewMode')) {

      $('visualViewMode').value =
        graphMode;

    }

  }


  function openGraphMonthMenu() {

    const menu =
      $('visualGraphMonthsMenu');

    const button =
      $('visualGraphMonthsButton');

    if (!menu) {
      return;
    }

    populateMonthMultiSelect();

    menu.classList.add(
      'open'
    );

    button?.setAttribute(
      'aria-expanded',
      'true'
    );

    setTimeout(
      () => {

        $('visualGraphMonthsSearch')
          ?.focus();

      },
      20
    );

  }


  function closeGraphMonthMenu() {

    const menu =
      $('visualGraphMonthsMenu');

    const button =
      $('visualGraphMonthsButton');

    if (menu) {

      menu.classList.remove(
        'open'
      );

    }

    button?.setAttribute(
      'aria-expanded',
      'false'
    );

  }


  function toggleGraphMonthMenu() {

    const menu =
      $('visualGraphMonthsMenu');

    if (!menu) {
      return;
    }

    if (
      menu.classList.contains(
        'open'
      )
    ) {

      closeGraphMonthMenu();

    } else {

      openGraphMonthMenu();

    }

  }


  /* =====================================================
     RPC
  ===================================================== */

  async function normalGroupData(view) {

    /*
       NORMAL VIEW:
       Exactly the normal dashboard logic.
       args() already contains dashboard Month.
    */
    return await rpc(
      'raj_group_summary',
      {
        p_view: view,
        ...args()
      }
    )
    ||
    [];

  }


  async function monthGroupData(
    view,
    monthList
  ) {

    const calls =
      monthList.map(
        async month => {

          const rows =
            await rpc(
              'raj_group_summary',
              {
                ...args(),
                p_view: view,

                /*
                   Override main dashboard Month
                   ONLY in Month Wise View.
                */
                p_months: [month]
              }
            )
            ||
            [];

          return {
            month,
            rows
          };

        }
      );


    return await Promise.all(
      calls
    );

  }


  async function mapGroupData(view) {

    /*
       INDIA MAP:
       Always uses normal dashboard filters/month.
    */
    return await rpc(
      'raj_group_summary',
      {
        p_view: view,
        ...args()
      }
    )
    ||
    [];

  }


  /* =====================================================
     NORMAL GRAPH
  ===================================================== */

  async function refreshNormalGraph(
    requestId,
    view,
    metric,
    topN,
    chartType
  ) {

    const rows =
      await normalGroupData(
        view
      );


    if (requestId !== graphRequestId) {
      return;
    }


    const sorted =
      [...rows]
        .sort(
          (a, b) =>
            metricValue(b, metric)
            -
            metricValue(a, metric)
        );


    const topRows =
      sorted.slice(
        0,
        topN
      );


    const labels =
      topRows.map(
        row =>
          String(
            row.label
            ??
            ''
          )
      );


    const values =
      topRows.map(
        row =>
          metricValue(
            row,
            metric
          )
      );


    const colors =
      topRows.map(
        (_, index) =>
          NORMAL_COLORS[
            index
            %
            NORMAL_COLORS.length
          ]
      );


    const dataset = {

      label:
        METRIC_NAMES[metric]
        ||
        metric,

      data:
        values,

      borderWidth: 2,

      borderRadius:
        chartType === 'bar'
          ? 8
          : 0,

      tension:
        chartType === 'line'
          ? .28
          : 0,

      fill: false

    };


    if (chartType === 'doughnut') {

      dataset.backgroundColor =
        colors;

      dataset.borderColor =
        '#ffffff';

    }

    else if (chartType === 'line') {

      dataset.borderColor =
        '#6757f5';

      dataset.backgroundColor =
        '#6757f5';

      dataset.pointBackgroundColor =
        colors;

    }

    else {

      dataset.backgroundColor =
        colors;

      dataset.borderColor =
        colors;

    }


    drawChart(
      chartType,
      labels,
      [dataset],
      metric,
      false
    );


    updateNormalKpis(
      view,
      rows,
      sorted,
      topN,
      metric
    );

  }


  function updateNormalKpis(
    view,
    rows,
    sorted,
    topN,
    metric
  ) {

    if ($('visualViewName')) {

      $('visualViewName')
        .textContent =
        VIEW_NAMES[view]
        ||
        view;

    }


    if ($('visualGroupCount')) {

      $('visualGroupCount')
        .textContent =
        indian(
          rows.length
        );

    }


    if ($('visualTopGroup')) {

      $('visualTopGroup')
        .textContent =
        sorted[0]
          ?.label
        ||
        '-';

    }


    if ($('visualTopSale')) {

      $('visualTopSale')
        .textContent =
        rupees(
          sorted[0]
            ?.taxable
          ||
          0
        );

    }


    if ($('visualChartTitle')) {

      $('visualChartTitle')
        .textContent =
        `Top ${
          Math.min(
            topN,
            rows.length
          )
        } ${
          VIEW_NAMES[view]
          ||
          view
        } by ${
          METRIC_NAMES[metric]
          ||
          metric
        }`;

    }


    if ($('visualChartNote')) {

      const mainMonths =
        dashboardMonths();

      $('visualChartNote')
        .textContent =
        mainMonths.length

          ? `Normal View • Dashboard Month: ${
              mainMonths
                .map(visualMonthName)
                .join(', ')
            }`

          : 'Normal View • All selected dashboard data';

    }

  }


  /* =====================================================
     MONTH WISE GRAPH
  ===================================================== */

  async function refreshMonthWiseGraph(
    requestId,
    view,
    metric,
    topN,
    chartType
  ) {

    const chosenMonths =
      selectedGraphMonths.filter(
        month =>
          availableMonths().includes(month)
      );


    if (!chosenMonths.length) {

      if (salesChart) {

        salesChart.destroy();

        salesChart = null;

      }


      if ($('visualChartNote')) {

        $('visualChartNote')
          .textContent =
          'Month Wise View • Please select at least one month';

      }

      if ($('visualChartTitle')) {

        $('visualChartTitle')
          .textContent =
          'Select Graph Months';

      }

      return;

    }


    if ($('visualChartNote')) {

      $('visualChartNote')
        .textContent =
        'Loading selected months...';

    }


    const monthResults =
      await monthGroupData(
        view,
        chosenMonths
      );


    if (requestId !== graphRequestId) {
      return;
    }


    const allLabels =
      new Set();


    monthResults.forEach(
      result => {

        result.rows.forEach(
          row => {

            const label =
              String(
                row.label
                ??
                ''
              ).trim();

            if (label) {

              allLabels.add(
                label
              );

            }

          }
        );

      }
    );


    const monthMaps =
      new Map();


    monthResults.forEach(
      result => {

        const rowMap =
          new Map();

        result.rows.forEach(
          row => {

            rowMap.set(
              String(
                row.label
                ??
                ''
              ).trim(),
              row
            );

          }
        );

        monthMaps.set(
          result.month,
          rowMap
        );

      }
    );


    /*
       Rank Top groups by selected months total.
    */
    const rankedGroups =
      [...allLabels]
        .map(
          label => {

            let total = 0;

            chosenMonths.forEach(
              month => {

                const row =
                  monthMaps
                    .get(month)
                    ?.get(label);

                if (row) {

                  total +=
                    metricValue(
                      row,
                      metric
                    );

                }

              }
            );

            return {
              label,
              total
            };

          }
        )
        .sort(
          (a, b) =>
            b.total - a.total
        )
        .slice(
          0,
          topN
        );


    const labels =
      rankedGroups.map(
        item =>
          item.label
      );


    /*
       Each selected Month is a separate dataset.
       Example:
       April + August = two bars per group.
    */
    const datasets =
      chosenMonths.map(
        (month, index) => {

          const rowMap =
            monthMaps.get(month);

          const data =
            labels.map(
              label => {

                const row =
                  rowMap
                    ?.get(label);

                return row
                  ? metricValue(
                      row,
                      metric
                    )
                  : 0;

              }
            );


          const color =
            MONTH_COLORS[
              index
              %
              MONTH_COLORS.length
            ];


          return {

            label:
              visualMonthName(month),

            data,

            backgroundColor:
              color,

            borderColor:
              color,

            borderWidth:
              1.5,

            borderRadius:
              6,

            tension:
              .28,

            fill:
              false,

            pointRadius:
              4,

            pointHoverRadius:
              6

          };

        }
      );


    drawChart(
      chartType,
      labels,
      datasets,
      metric,
      true
    );


    updateMonthWiseKpis(
      view,
      metric,
      topN,
      allLabels,
      rankedGroups,
      monthMaps,
      chosenMonths
    );

  }





   function updateMonthWiseKpis(
    view,
    metric,
    topN,
    allLabels,
    rankedGroups,
    monthMaps,
    chosenMonths
  ) {

    if ($('visualViewName')) {

      $('visualViewName')
        .textContent =
        VIEW_NAMES[view]
        ||
        view;

    }


    if ($('visualGroupCount')) {

      $('visualGroupCount')
        .textContent =
        indian(
          allLabels.size
        );

    }


    if ($('visualTopGroup')) {

      $('visualTopGroup')
        .textContent =
        rankedGroups[0]
          ?.label
        ||
        '-';

    }


    let topTaxableValue = 0;


    [...allLabels].forEach(
      label => {

        let totalTaxable = 0;

        chosenMonths.forEach(
          month => {

            const row =
              monthMaps
                .get(month)
                ?.get(label);

            if (row) {

              totalTaxable +=
                number(
                  row.taxable
                );

            }

          }
        );


        if (
          totalTaxable
          >
          topTaxableValue
        ) {

          topTaxableValue =
            totalTaxable;

        }

      }
    );


    if ($('visualTopSale')) {

      $('visualTopSale')
        .textContent =
        rupees(
          topTaxableValue
        );

    }


    if ($('visualChartTitle')) {

      $('visualChartTitle')
        .textContent =
        `Top ${
          Math.min(
            topN,
            rankedGroups.length
          )
        } ${
          VIEW_NAMES[view]
          ||
          view
        } - Month Wise ${
          METRIC_NAMES[metric]
          ||
          metric
        }`;

    }


    if ($('visualChartNote')) {

      $('visualChartNote')
        .textContent =
        `Month Wise View • ${
          chosenMonths
            .map(visualMonthName)
            .join(', ')
        }`;

    }

  }


  /* =====================================================
     DRAW CHART
  ===================================================== */

  function drawChart(
    chartType,
    labels,
    datasets,
    metric,
    monthWise
  ) {

    const canvas =
      $('salesVisualChart');


    if (!canvas) {
      return;
    }


    if (salesChart) {

      salesChart.destroy();

      salesChart = null;

    }


    salesChart =
      new Chart(
        canvas,
        {

          type:
            chartType,

          data: {
            labels,
            datasets
          },

          options: {

            responsive:
              true,

            maintainAspectRatio:
              false,

            animation: {
              duration: 300
            },

            interaction: {
              mode: 'nearest',
              intersect: false
            },

            plugins: {

              legend: {

                display:
                  monthWise
                  ||
                  chartType === 'doughnut',

                position:
                  'top',

                labels: {
                  usePointStyle: true,
                  boxWidth: 9,
                  padding: 16
                }

              },

              tooltip: {

                callbacks: {

                  label(context) {

                    const raw =
                      context.raw
                      ??
                      0;

                    const prefix =
                      monthWise
                        ? context.dataset.label + ': '
                        : (
                            METRIC_NAMES[metric]
                            +
                            ': '
                          );

                    return (
                      prefix
                      +
                      metricText(
                        raw,
                        metric
                      )
                    );

                  }

                }

              }

            },

            scales:

              chartType === 'doughnut'

                ? {}

                : {

                    x: {

                      stacked:
                        false,

                      grid: {
                        display: false
                      },

                      ticks: {
                        autoSkip: false,
                        maxRotation: 45,
                        minRotation: 0
                      }

                    },

                    y: {

                      stacked:
                        false,

                      beginAtZero:
                        true,

                      ticks: {

                        callback(value) {

                          if (
                            metric
                            ===
                            'taxable'
                          ) {

                            return '₹'
                              +
                              compact(value);

                          }

                          return compact(
                            value
                          );

                        }

                      }

                    }

                  }

          }

        }
      );

  }


  /* =====================================================
     REFRESH GRAPH
  ===================================================== */

  async function refreshGraph() {

    const canvas =
      $('salesVisualChart');


    if (
      !canvas
      ||
      typeof Chart === 'undefined'
    ) {

      return;

    }


    const requestId =
      ++graphRequestId;


    try {

      /*
         online47:
         This now synchronises checkbox state without
         turning an intentional empty selection back
         into Select All.
      */
      populateMonthMultiSelect();


      const view =
        typeof currentView !== 'undefined'
          ? currentView
          : 'Party';

      const metric =
        currentMetric();

      const topN =
        currentTopN();

      const chartType =
        currentChartType();


      if (
        graphMode
        ===
        'monthwise'
      ) {

        await refreshMonthWiseGraph(
          requestId,
          view,
          metric,
          topN,
          chartType
        );

      } else {

        await refreshNormalGraph(
          requestId,
          view,
          metric,
          topN,
          chartType
        );

      }

    }

    catch (error) {

      console.error(
        'Visual graph error:',
        error
      );


      if ($('visualChartNote')) {

        $('visualChartNote')
          .textContent =
          'Graph error: '
          +
          (
            error.message
            ||
            error
          );

      }

    }

  }


  /* =====================================================
     PINCODE CSV
  ===================================================== */

  function parseCSVLine(line) {

    const values = [];

    let value = '';

    let quoted = false;


    for (
      let i = 0;
      i < line.length;
      i++
    ) {

      const ch =
        line[i];


      if (ch === '"') {

        if (
          quoted
          &&
          line[i + 1] === '"'
        ) {

          value += '"';

          i++;

        } else {

          quoted =
            !quoted;

        }

      }

      else if (
        ch === ','
        &&
        !quoted
      ) {

        values.push(
          value
        );

        value = '';

      }

      else {

        value += ch;

      }

    }


    values.push(
      value
    );

    return values;

  }


  async function loadPincodeLookup() {

    if (pinLookup) {

      return pinLookup;

    }


    if ($('visualMapStatus')) {

      $('visualMapStatus')
        .textContent =
        'Loading India Pincode locations...';

    }


    const response =
      await fetch(
        PINCODE_COORDS_URL,
        {
          cache:
            'force-cache'
        }
      );


    if (!response.ok) {

      throw new Error(
        'Pincode location file could not be loaded.'
      );

    }


    const text =
      await response.text();


    const lines =
      text
        .split(/\r?\n/)
        .filter(Boolean);


    const lookup =
      new Map();


    for (
      let i = 1;
      i < lines.length;
      i++
    ) {

      const cols =
        parseCSVLine(
          lines[i]
        );


      const pin =
        String(
          cols[1]
          ||
          ''
        ).trim();


      const area =
        String(
          cols[2]
          ||
          ''
        ).trim();


      const state =
        String(
          cols[3]
          ||
          ''
        ).trim();


      const lat =
        Number(
          cols[4]
        );


      const lng =
        Number(
          cols[5]
        );


      if (
        /^\d{6}$/.test(pin)
        &&
        Number.isFinite(lat)
        &&
        Number.isFinite(lng)
      ) {

        lookup.set(
          pin,
          {
            lat,
            lng,
            area,
            state
          }
        );

      }

    }


    pinLookup =
      lookup;

    return lookup;

  }


  /* =====================================================
     ALL PINCODES
  ===================================================== */

  function installAllPincodesOption() {

    const select =
      $('visualMapLimit');


    if (!select) {
      return;
    }


    if (
      select.querySelector(
        'option[value="all"]'
      )
    ) {

      return;

    }


    const option =
      document.createElement(
        'option'
      );


    option.value =
      'all';


    option.textContent =
      'All Pincodes';


    select.insertBefore(
      option,
      select.firstChild
    );

  }


  /* =====================================================
     PINCODE DETAILS
  ===================================================== */

  function ensureMapDetailsCard() {

    const map =
      $('salesIndiaMap');


    if (!map) {
      return null;
    }


    let card =
      $('visualMapDetails');


    if (card) {

      return card;

    }


    card =
      document.createElement(
        'div'
      );


    card.id =
      'visualMapDetails';


    card.className =
      'visual-map-details';


    card.innerHTML = `

      <div class="visual-map-details-head">

        <div>

          <span>
            Selected Pincode
          </span>

          <strong id="visualSelectedPin">
            Click any map point
          </strong>

        </div>

        <button
          type="button"
          id="visualMapDetailsClose"
          aria-label="Close"
        >
          ×
        </button>

      </div>


      <div
        id="visualMapDetailsLocation"
        class="visual-map-details-location"
      >
        Pincode details will appear here.
      </div>


      <div class="visual-map-details-grid">

        <div class="visual-map-detail-item">

          <span>
            Taxable Sales
          </span>

          <strong id="visualSelectedTaxable">
            -
          </strong>

        </div>


        <div class="visual-map-detail-item">

          <span>
            Customers Billed
          </span>

          <strong id="visualSelectedCustomers">
            -
          </strong>

        </div>


        <div class="visual-map-detail-item">

          <span>
            Quantity
          </span>

          <strong id="visualSelectedQty">
            -
          </strong>

        </div>


        <div class="visual-map-detail-item">

          <span>
            Products Sold
          </span>

          <strong id="visualSelectedProducts">
            -
          </strong>

        </div>


        <div class="visual-map-detail-item">

          <span>
            Records
          </span>

          <strong id="visualSelectedRecords">
            -
          </strong>

        </div>


        <div class="visual-map-detail-item">

          <span>
            Bubble Metric
          </span>

          <strong id="visualSelectedMetric">
            -
          </strong>

        </div>

      </div>
    `;


    map.insertAdjacentElement(
      'beforebegin',
      card
    );


    $('visualMapDetailsClose')
      ?.addEventListener(
        'click',
        () => {

          card.classList.remove(
            'show'
          );

        }
      );


    return card;

  }


  function showPincodeDetails(
    pin,
    geo,
    row,
    metric
  ) {

    const card =
      ensureMapDetailsCard();


    if (!card) {
      return;
    }


    const location =
      [
        geo?.area,
        geo?.state
      ]
        .filter(Boolean)
        .join(' • ');


    const customers =
      row.customersBilled
      ??
      row.customersbilled
      ??
      0;


    const products =
      row.productsSold
      ??
      row.productssold
      ??
      0;


    const records =
      row.records
      ??
      row.recordCount
      ??
      row.recordcount
      ??
      0;


    if ($('visualSelectedPin')) {

      $('visualSelectedPin')
        .textContent =
        pin;

    }


    if ($('visualMapDetailsLocation')) {

      $('visualMapDetailsLocation')
        .textContent =
        location
        ||
        'Location not available';

    }


    if ($('visualSelectedTaxable')) {

      $('visualSelectedTaxable')
        .textContent =
        rupees(
          row.taxable
        );

    }


    if ($('visualSelectedCustomers')) {

      $('visualSelectedCustomers')
        .textContent =
        indian(
          customers
        );

    }


    if ($('visualSelectedQty')) {

      $('visualSelectedQty')
        .textContent =
        indian(
          row.qty,
          2
        );

    }


    if ($('visualSelectedProducts')) {

      $('visualSelectedProducts')
        .textContent =
        indian(
          products
        );

    }


    if ($('visualSelectedRecords')) {

      $('visualSelectedRecords')
        .textContent =
        indian(
          records
        );

    }


    if ($('visualSelectedMetric')) {

      $('visualSelectedMetric')
        .textContent =
        (
          METRIC_NAMES[metric]
          ||
          metric
        )
        +
        ': '
        +
        metricText(
          metricValue(
            row,
            metric
          ),
          metric
        );

    }


    card.classList.add(
      'show'
    );

  }




   /* =====================================================
     INDIA MAP
  ===================================================== */

  function ensureMap() {

    if (
      indiaMap
      ||
      typeof L === 'undefined'
    ) {

      return;

    }


    indiaMap =
      L.map(
        'salesIndiaMap',
        {
          zoomControl:
            true,

          minZoom:
            4,

          preferCanvas:
            true
        }
      )
        .setView(
          [
            22.8,
            79.0
          ],
          5
        );


    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom:
          18,

        attribution:
          '&copy; OpenStreetMap contributors'
      }
    )
      .addTo(
        indiaMap
      );


    mapLayer =
      L.layerGroup()
        .addTo(
          indiaMap
        );

  }


  async function refreshMap() {

    if (!$('salesIndiaMap')) {
      return;
    }


    try {

      installAllPincodesOption();

      ensureMapDetailsCard();

      ensureMap();


      if ($('visualMapStatus')) {

        $('visualMapStatus')
          .textContent =
          'Loading filtered Pincode sales...';

      }


      const [
        rows,
        lookup
      ] =
        await Promise.all(
          [
            mapGroupData(
              'Pincode'
            ),

            loadPincodeLookup()
          ]
        );


      const metric =
        $('visualMapMetric')
          ?.value
        ||
        'taxable';


      const limitValue =
        $('visualMapLimit')
          ?.value
        ||
        '50';


      const validRows =
        [...rows]
          .filter(
            row =>
              /^\d{6}$/.test(
                String(
                  row.label
                  ||
                  ''
                ).trim()
              )
          )
          .sort(
            (a, b) =>
              metricValue(
                b,
                metric
              )
              -
              metricValue(
                a,
                metric
              )
          );


      const selectedRows =
        limitValue === 'all'

          ? validRows

          : validRows.slice(
              0,
              Number(
                limitValue
                ||
                50
              )
            );


      mapLayer.clearLayers();


      const mapped =
        [];


      const maxValue =
        Math.max(
          1,
          ...selectedRows.map(
            row =>
              metricValue(
                row,
                metric
              )
          )
        );


      for (
        const row
        of selectedRows
      ) {

        const pin =
          String(
            row.label
          ).trim();


        const geo =
          lookup.get(
            pin
          );


        if (!geo) {
          continue;
        }


        const value =
          metricValue(
            row,
            metric
          );


        const radius =
          5
          +
          17
          *
          Math.sqrt(
            Math.max(
              0,
              value
            )
            /
            maxValue
          );


        const customers =
          row.customersBilled
          ??
          row.customersbilled
          ??
          0;


        const products =
          row.productsSold
          ??
          row.productssold
          ??
          0;


        const records =
          row.records
          ??
          row.recordCount
          ??
          row.recordcount
          ??
          0;


        const circle =
          L.circleMarker(
            [
              geo.lat,
              geo.lng
            ],
            {
              radius,
              weight: 2,
              opacity: .9,
              fillOpacity: .65
            }
          );


        circle.bindPopup(
          `
            <div class="raj-map-popup">

              <strong>
                ${escapeHtml(pin)}
              </strong>

              <br>

              ${
                geo.area
                  ? escapeHtml(geo.area) + '<br>'
                  : ''
              }

              ${
                geo.state
                  ? escapeHtml(geo.state) + '<br>'
                  : ''
              }

              <hr>

              Taxable Sales:
              <b>
                ${rupees(row.taxable)}
              </b>

              <br>

              Customers Billed:
              <b>
                ${indian(customers)}
              </b>

              <br>

              Quantity:
              <b>
                ${indian(row.qty, 2)}
              </b>

              <br>

              Products Sold:
              <b>
                ${indian(products)}
              </b>

              <br>

              Records:
              <b>
                ${indian(records)}
              </b>

            </div>
          `
        );


        circle.on(
          'click',
          () => {

            showPincodeDetails(
              pin,
              geo,
              row,
              metric
            );

          }
        );


        circle.addTo(
          mapLayer
        );


        mapped.push(
          [
            geo.lat,
            geo.lng
          ]
        );

      }


      if (mapped.length) {

        indiaMap.fitBounds(
          L.latLngBounds(
            mapped
          ),
          {
            padding:
              [30, 30],

            maxZoom:
              9
          }
        );

      } else {

        indiaMap.setView(
          [
            22.8,
            79.0
          ],
          5
        );

      }


      setTimeout(
        () =>
          indiaMap.invalidateSize(),
        100
      );


      if ($('visualMapStatus')) {

        const mainMonths =
          dashboardMonths();


        const pointText =
          limitValue === 'all'
            ? 'All Pincodes'
            : `Top ${limitValue} Pincodes`;


        $('visualMapStatus')
          .textContent =
          `${pointText} • ${mapped.length} mapped • ${rows.length} filtered Pincode groups`
          +
          (
            mainMonths.length

              ? ` • Month: ${
                  mainMonths
                    .map(visualMonthName)
                    .join(', ')
                }`

              : ' • All Months / Total'
          );

      }

    }

    catch (error) {

      console.error(
        'India map error:',
        error
      );


      if ($('visualMapStatus')) {

        $('visualMapStatus')
          .textContent =
          'Map error: '
          +
          (
            error.message
            ||
            error
          );

      }

    }

  }


  /* =====================================================
     ACTIVE VISUAL
  ===================================================== */

  async function refreshActiveVisual() {

    const mapActive =
      $('mapVisualPane')
        ?.classList
        .contains(
          'active'
        );


    if (mapActive) {

      await refreshMap();

    } else {

      await refreshGraph();

    }

  }


  /* =====================================================
     GRAPH / MAP TAB
  ===================================================== */

  function switchVisual(mode) {

    document
      .querySelectorAll(
        '.visual-mode-btn'
      )
      .forEach(
        button => {

          button.classList.toggle(
            'active',
            button.dataset.visualMode
            ===
            mode
          );

        }
      );


    $('graphVisualPane')
      ?.classList
      .toggle(
        'active',
        mode === 'graph'
      );


    $('mapVisualPane')
      ?.classList
      .toggle(
        'active',
        mode === 'map'
      );


    if (mode === 'map') {

      setTimeout(
        refreshMap,
        50
      );

    } else {

      setTimeout(
        refreshGraph,
        50
      );

    }

  }


  /* =====================================================
     GRAPH MODE + MONTH MULTI SELECT
     online47:
     - Search month
     - Select All
     - Real Unselect All
     - Small checkbox
     - Empty selection remains empty
  ===================================================== */

  function wireGraphChoiceControls() {

    $('visualViewMode')
      ?.addEventListener(
        'change',
        event => {

          graphMode =
            event.target.value
            ===
            'monthwise'

              ? 'monthwise'

              : 'normal';


          updateGraphModeUI();

          closeGraphMonthMenu();

          refreshGraph();

        }
      );


    $('visualGraphMonthsButton')
      ?.addEventListener(
        'click',
        event => {

          event.preventDefault();

          event.stopPropagation();

          toggleGraphMonthMenu();

        }
      );


    /*
       Search only hides/shows month rows.
       It does NOT change selected months.
    */
    $('visualGraphMonthsSearch')
      ?.addEventListener(
        'input',
        event => {

          event.stopPropagation();

          filterGraphMonthOptions();

        }
      );


    $('visualGraphMonthsSearch')
      ?.addEventListener(
        'click',
        event => {

          event.stopPropagation();

        }
      );


    /*
       SELECT ALL
    */
    $('visualGraphMonthsAll')
      ?.addEventListener(
        'click',
        event => {

          event.preventDefault();

          event.stopPropagation();


          graphMonthsInitialized =
            true;


          selectedGraphMonths =
            [...availableMonths()];


          document
            .querySelectorAll(
              '#visualGraphMonthsOptions input.visual-month-check[type="checkbox"]'
            )
            .forEach(
              input => {

                input.checked =
                  true;

              }
            );


          updateMonthButtonText();

          refreshGraph();

        }
      );


    /*
       UNSELECT ALL - online47 FIX

       Important:
       graphMonthsInitialized remains TRUE.

       Therefore [] means:
       "The user intentionally selected no months."

       refreshGraph() will NOT auto-select all again.
    */
    $('visualGraphMonthsNone')
      ?.addEventListener(
        'click',
        event => {

          event.preventDefault();

          event.stopPropagation();


          graphMonthsInitialized =
            true;


          selectedGraphMonths =
            [];


          document
            .querySelectorAll(
              '#visualGraphMonthsOptions input.visual-month-check[type="checkbox"]'
            )
            .forEach(
              input => {

                input.checked =
                  false;

              }
            );


          updateMonthButtonText();

          refreshGraph();

        }
      );


    /*
       Individual month checkbox.
    */
    $('visualGraphMonthsOptions')
      ?.addEventListener(
        'change',
        event => {

          const input =
            event.target;


          if (
            !input.matches(
              'input.visual-month-check[type="checkbox"]'
            )
          ) {

            return;

          }


          graphMonthsInitialized =
            true;


          const month =
            input.value;


          if (input.checked) {

            if (
              !selectedGraphMonths.includes(
                month
              )
            ) {

              selectedGraphMonths.push(
                month
              );

            }

          } else {

            selectedGraphMonths =
              selectedGraphMonths.filter(
                item =>
                  item !== month
              );

          }


          /*
             Keep database/schema month order.
          */
          const order =
            availableMonths();


          selectedGraphMonths.sort(
            (a, b) =>
              order.indexOf(a)
              -
              order.indexOf(b)
          );


          updateMonthButtonText();

          refreshGraph();

        }
      );


    /*
       Prevent clicks inside menu from reaching
       the document outside-click handler.
    */
    $('visualGraphMonthsMenu')
      ?.addEventListener(
        'click',
        event => {

          event.stopPropagation();

        }
      );

  }






   /* =====================================================
     MAIN EVENTS
  ===================================================== */

  function wireVisuals() {

    installAllPincodesOption();

    ensureMapDetailsCard();

    installGraphControls();

    wireGraphChoiceControls();


    /*
       Schema/months can finish loading after this addon.
       Refresh month options after startup.

       online47:
       graphMonthsInitialized prevents an intentional
       empty selection from becoming Select All again.
    */
    setTimeout(
      () => {

        populateMonthMultiSelect(
          true
        );

      },
      800
    );


    setTimeout(
      () => {

        populateMonthMultiSelect(
          true
        );

      },
      1600
    );


    document
      .querySelectorAll(
        '.visual-mode-btn'
      )
      .forEach(
        button => {

          button.addEventListener(
            'click',
            () => {

              switchVisual(
                button.dataset.visualMode
              );

            }
          );

        }
      );


    [
      'visualChartType',
      'visualTopN',
      'visualMetric'
    ]
      .forEach(
        id => {

          $(id)
            ?.addEventListener(
              'change',
              refreshGraph
            );

        }
      );


    [
      'visualMapLimit',
      'visualMapMetric'
    ]
      .forEach(
        id => {

          $(id)
            ?.addEventListener(
              'change',
              refreshMap
            );

        }
      );


    $('visualRefresh')
      ?.addEventListener(
        'click',
        refreshActiveVisual
      );


    document
      .querySelectorAll(
        '#viewTabs button'
      )
      .forEach(
        button => {

          button.addEventListener(
            'click',
            () => {

              setTimeout(
                refreshActiveVisual,
                150
              );

            }
          );

        }
      );


    /*
       Main dashboard filters.
    */
    document.addEventListener(
      'change',
      event => {

        /*
           Do not treat Graph Month controls as
           main-dashboard filter changes.
        */
        if (
          event.target.closest(
            '#visualAnalysisPanel'
          )
        ) {

          return;

        }


        setTimeout(
          refreshActiveVisual,
          350
        );

      }
    );


    $('search')
      ?.addEventListener(
        'input',
        () => {

          setTimeout(
            refreshActiveVisual,
            700
          );

        }
      );


    $('clearFilters')
      ?.addEventListener(
        'click',
        () => {

          setTimeout(
            refreshActiveVisual,
            500
          );

        }
      );


    document.addEventListener(
      'click',
      event => {

        /*
           Close Graph Months dropdown
           when clicking outside.
        */
        if (
          !event.target.closest(
            '#visualGraphMonthsField'
          )
        ) {

          closeGraphMonthMenu();

        }


        /*
           Existing dashboard multi filters.
        */
        if (
          event.target.closest(
            '.multi-option input, [data-select-all], [data-unselect-all]'
          )
        ) {

          setTimeout(
            refreshActiveVisual,
            500
          );

        }

      }
    );


    /*
       Escape key closes Graph Months dropdown.
    */
    document.addEventListener(
      'keydown',
      event => {

        if (
          event.key === 'Escape'
        ) {

          closeGraphMonthMenu();

        }

      }
    );


    /*
       Default must ALWAYS remain Normal View.
    */
    graphMode =
      'normal';


    updateGraphModeUI();


    setTimeout(
      refreshGraph,
      1200
    );

  }


  /* =====================================================
     START
  ===================================================== */

  if (
    document.readyState
    ===
    'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      wireVisuals
    );

  } else {

    wireVisuals();

  }

})();

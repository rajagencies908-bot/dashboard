/* =========================================================
   RAJ AGENCIES - visual-addon.js - online44
   Graph View + Independent Graph Month + India Pincode Map

   NEW:
   - Independent Graph Month selector
   - All Months / Total option
   - Months automatically come from dashboard schema
   - Graph Month does NOT change main dashboard Month

   KEPT:
   - All Pincodes option
   - Click Pincode -> Selected Pincode Details
   - India Map
   - Main dashboard filters
========================================================= */

(() => {

  'use strict';

  const PINCODE_COORDS_URL =
    'https://raw.githubusercontent.com/mrparveensharma/All-India-Pincode-list-with-latitude-and-longitude/refs/heads/master/Minimal-India-Pincode-list-with-latitude-and-longitude.csv';

  const VIEW_NAMES = {
    Party:'Customer Wise',
    MainGrp:'Company Wise',
    ItemName:'Product Wise',
    SM:'SM Wise',
    Division:'Division Wise',
    Area:'Area Wise',
    City:'City Wise',
    Pincode:'Pincode Wise'
  };

  const METRIC_NAMES = {
    taxable:'Taxable Sales',
    qty:'Quantity',
    customers:'Customers Billed',
    products:'Products Sold',
    records:'Records'
  };

  let salesChart = null;
  let indiaMap = null;
  let mapLayer = null;
  let pinLookup = null;
  let visualBusy = false;

  const $ = id =>
    document.getElementById(id);


  function number(value){

    const n =
      Number(value || 0);

    return Number.isFinite(n)
      ? n
      : 0;

  }


  function indian(
    value,
    digits = 0
  ){

    return new Intl.NumberFormat(
      'en-IN',
      {
        maximumFractionDigits:digits
      }
    ).format(
      number(value)
    );

  }


  function rupees(value){

    return '₹' +
      new Intl.NumberFormat(
        'en-IN',
        {
          maximumFractionDigits:0
        }
      ).format(
        number(value)
      );

  }


  function compact(value){

    const n =
      Math.abs(
        number(value)
      );

    if(n >= 10000000){

      return (
        number(value)
        /
        10000000
      ).toFixed(1)
      +
      ' Cr';

    }

    if(n >= 100000){

      return (
        number(value)
        /
        100000
      ).toFixed(1)
      +
      ' L';

    }

    if(n >= 1000){

      return (
        number(value)
        /
        1000
      ).toFixed(1)
      +
      ' K';

    }

    return indian(value);

  }


  function escapeHtml(value){

    const div =
      document.createElement('div');

    div.textContent =
      String(
        value ?? ''
      );

    return div.innerHTML;

  }


  function currentMetric(){

    return $('visualMetric')
      ?.value
      ||
      'taxable';

  }


  function metricValue(
    row,
    metric
  ){

    if(metric === 'customers'){

      return number(
        row.customersBilled
        ??
        row.customersbilled
      );

    }

    if(metric === 'products'){

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


  function metricText(
    value,
    metric
  ){

    return metric === 'taxable'

      ? rupees(value)

      : indian(
          value,
          metric === 'qty'
            ? 2
            : 0
        );

  }


  /* =====================================================
     MONTH DISPLAY NAME
  ===================================================== */

  function visualMonthName(month){

    if(
      typeof monthNames !== 'undefined'
      &&
      monthNames
      &&
      monthNames[month]
    ){

      return monthNames[month];

    }

    return month;

  }


  /* =====================================================
     MAIN DASHBOARD SELECTED MONTH
     Used by India Map
  ===================================================== */

  function selectedDashboardMonths(){

    if(
      typeof selected !== 'undefined'
      &&
      Array.isArray(selected.month)
    ){

      return [
        ...selected.month
      ];

    }

    return [];

  }


  /* =====================================================
     GRAPH MONTH SELECTOR
  ===================================================== */

  function installGraphMonthSelector(){

    const controls =
      document.querySelector(
        '#graphVisualPane .visual-controls'
      );

    if(!controls){
      return;
    }

    let wrapper =
      $('visualGraphMonthField');

    if(!wrapper){

      wrapper =
        document.createElement(
          'div'
        );

      wrapper.id =
        'visualGraphMonthField';

      wrapper.className =
        'field';

      wrapper.innerHTML = `
        <label>
          Graph Month
        </label>

        <select id="visualGraphMonth">
          <option value="">
            All Months / Total
          </option>
        </select>
      `;

      controls.appendChild(
        wrapper
      );

    }

    populateGraphMonths();

  }


  function populateGraphMonths(){

    const select =
      $('visualGraphMonth');

    if(!select){
      return;
    }

    const oldValue =
      select.value;

    const availableMonths =
      (
        typeof months !== 'undefined'
        &&
        Array.isArray(months)
      )
        ? [...months]
        : [];

    select.innerHTML =
      `
        <option value="">
          All Months / Total
        </option>
      `;

    availableMonths.forEach(
      month => {

        const option =
          document.createElement(
            'option'
          );

        option.value =
          month;

        option.textContent =
          visualMonthName(
            month
          );

        select.appendChild(
          option
        );

      }
    );

    if(
      oldValue
      &&
      availableMonths.includes(
        oldValue
      )
    ){

      select.value =
        oldValue;

    }

  }


  function selectedGraphMonths(){

    const value =
      $('visualGraphMonth')
        ?.value
      ||
      '';

    if(value){

      return [
        value
      ];

    }

    /*
      Blank Graph Month means:
      All Months / Total.

      It is intentionally independent from
      main dashboard Month.
    */

    return [];

  }


  function graphMonthText(){

    const selectedMonths =
      selectedGraphMonths();

    if(!selectedMonths.length){

      return 'All Months / Total';

    }

    return selectedMonths
      .map(
        visualMonthName
      )
      .join(', ');

  }


  /* =====================================================
     GROUP DATA
  ===================================================== */

  async function getGroupData(
    view,
    monthMode = 'dashboard'
  ){

    const selectedMonths =
      monthMode === 'graph'
        ? selectedGraphMonths()
        : selectedDashboardMonths();

    const baseArgs =
      args();

    return await rpc(
      'raj_group_summary',
      {
        ...baseArgs,

        p_view:view,

        /*
          Override args().p_months here.

          Graph:
          independent Graph Month.

          Map:
          normal dashboard Month.
        */
        p_months:selectedMonths
      }
    )
    ||
    [];

  }


  function palette(count){

    const base = [

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

    return Array.from(
      {
        length:count
      },
      (_,i) =>
        base[
          i
          %
          base.length
        ]
    );

  }


  /* =====================================================
     GRAPH
  ===================================================== */

  async function refreshGraph(){

    if(visualBusy){
      return;
    }

    const canvas =
      $('salesVisualChart');

    if(
      !canvas
      ||
      typeof Chart === 'undefined'
    ){
      return;
    }

    visualBusy = true;

    try{

      populateGraphMonths();

      const view =
        currentView
        ||
        'Party';

      const metric =
        currentMetric();

      const topN =
        Number(
          $('visualTopN')
            ?.value
          ||
          10
        );

      /*
        IMPORTANT:
        Graph uses independent Graph Month.
      */
      const rows =
        await getGroupData(
          view,
          'graph'
        );

      const sorted =
        [...rows]
          .sort(
            (a,b) =>
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

      const chartType =
        $('visualChartType')
          ?.value
        ||
        'bar';

      const colors =
        palette(
          topRows.length
        );

      if(salesChart){

        salesChart.destroy();

        salesChart = null;

      }

      const dataset = {

        label:
          METRIC_NAMES[metric]
          ||
          metric,

        data:
          values,

        borderWidth:2,

        borderRadius:
          chartType === 'bar'
            ? 8
            : 0,

        tension:
          chartType === 'line'
            ? 0.28
            : 0,

        fill:false

      };


      if(chartType === 'doughnut'){

        dataset.backgroundColor =
          colors;

        dataset.borderColor =
          '#ffffff';

      }

      else if(chartType === 'line'){

        dataset.borderColor =
          '#6757f5';

        dataset.backgroundColor =
          '#6757f5';

        dataset.pointBackgroundColor =
          colors;

      }

      else{

        dataset.backgroundColor =
          colors;

        dataset.borderColor =
          colors;

      }


      salesChart =
        new Chart(
          canvas,
          {

            type:
              chartType,

            data:{

              labels,

              datasets:[
                dataset
              ]

            },

            options:{

              responsive:true,

              maintainAspectRatio:false,

              animation:{
                duration:350
              },

              interaction:{
                mode:'nearest',
                intersect:false
              },

              plugins:{

                legend:{

                  display:
                    chartType
                    ===
                    'doughnut',

                  position:'bottom'

                },

                tooltip:{

                  callbacks:{

                    label(context){

                      const val =
                        context.parsed?.y
                        ??
                        context.parsed
                        ??
                        context.raw;

                      return (
                        METRIC_NAMES[metric]
                        +
                        ': '
                        +
                        metricText(
                          val,
                          metric
                        )
                      );

                    }

                  }

                }

              },

              scales:

                chartType
                ===
                'doughnut'

                  ? {}

                  : {

                      x:{

                        ticks:{
                          autoSkip:false,
                          maxRotation:45,
                          minRotation:0
                        },

                        grid:{
                          display:false
                        }

                      },

                      y:{

                        beginAtZero:true,

                        ticks:{

                          callback(value){

                            return metric
                              ===
                              'taxable'

                              ? '₹'
                                +
                                compact(value)

                              : compact(value);

                          }

                        }

                      }

                    }

            }

          }
        );


      if($('visualViewName')){

        $('visualViewName')
          .textContent =
          VIEW_NAMES[view]
          ||
          view;

      }


      if($('visualGroupCount')){

        $('visualGroupCount')
          .textContent =
          indian(
            rows.length
          );

      }


      if($('visualTopGroup')){

        $('visualTopGroup')
          .textContent =
          sorted[0]
            ?.label
          ||
          '-';

      }


      if($('visualTopSale')){

        $('visualTopSale')
          .textContent =
          rupees(
            sorted[0]
              ?.taxable
            ||
            0
          );

      }


      if($('visualChartTitle')){

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


      if($('visualChartNote')){

        $('visualChartNote')
          .textContent =
          `Graph Month: ${graphMonthText()}`;

      }

    }catch(error){

      console.error(
        'Visual graph error:',
        error
      );

      if($('visualChartNote')){

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

    }finally{

      visualBusy = false;

    }

  }


  /* =====================================================
     PINCODE CSV
  ===================================================== */

  function parseCSVLine(line){

    const values = [];

    let value = '';

    let quoted = false;

    for(
      let i = 0;
      i < line.length;
      i++
    ){

      const ch =
        line[i];

      if(ch === '"'){

        if(
          quoted
          &&
          line[i + 1] === '"'
        ){

          value += '"';

          i++;

        }else{

          quoted =
            !quoted;

        }

      }

      else if(
        ch === ','
        &&
        !quoted
      ){

        values.push(
          value
        );

        value = '';

      }

      else{

        value += ch;

      }

    }

    values.push(
      value
    );

    return values;

  }


  async function loadPincodeLookup(){

    if(pinLookup){

      return pinLookup;

    }

    const status =
      $('visualMapStatus');

    if(status){

      status.textContent =
        'Loading India Pincode locations...';

    }

    const response =
      await fetch(
        PINCODE_COORDS_URL,
        {
          cache:'force-cache'
        }
      );

    if(!response.ok){

      throw new Error(
        'Pincode location file could not be loaded.'
      );

    }

    const text =
      await response.text();

    const lines =
      text
        .split(
          /\r?\n/
        )
        .filter(
          Boolean
        );

    const lookup =
      new Map();

    for(
      let i = 1;
      i < lines.length;
      i++
    ){

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

      if(
        /^\d{6}$/.test(pin)
        &&
        Number.isFinite(lat)
        &&
        Number.isFinite(lng)
      ){

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
     ALL PINCODES OPTION
  ===================================================== */

  function installAllPincodesOption(){

    const select =
      $('visualMapLimit');

    if(!select){
      return;
    }

    if(
      select.querySelector(
        'option[value="all"]'
      )
    ){
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
     SELECTED PINCODE DETAILS CARD
  ===================================================== */

  function ensureMapDetailsCard(){

    const map =
      $('salesIndiaMap');

    if(!map){
      return null;
    }

    let card =
      $('visualMapDetails');

    if(card){
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
          aria-label="Close selected Pincode details"
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
  ){

    const card =
      ensureMapDetailsCard();

    if(!card){
      return;
    }

    const area =
      String(
        geo?.area
        ||
        ''
      ).trim();

    const state =
      String(
        geo?.state
        ||
        ''
      ).trim();

    const locationParts =
      [
        area,
        state
      ]
      .filter(
        Boolean
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

    if($('visualSelectedPin')){

      $('visualSelectedPin')
        .textContent =
        pin;

    }

    if($('visualMapDetailsLocation')){

      $('visualMapDetailsLocation')
        .textContent =
        locationParts.length
          ? locationParts.join(' • ')
          : 'Location not available';

    }

    if($('visualSelectedTaxable')){

      $('visualSelectedTaxable')
        .textContent =
        rupees(
          row.taxable
        );

    }

    if($('visualSelectedCustomers')){

      $('visualSelectedCustomers')
        .textContent =
        indian(
          customers
        );

    }

    if($('visualSelectedQty')){

      $('visualSelectedQty')
        .textContent =
        indian(
          row.qty,
          2
        );

    }

    if($('visualSelectedProducts')){

      $('visualSelectedProducts')
        .textContent =
        indian(
          products
        );

    }

    if($('visualSelectedRecords')){

      $('visualSelectedRecords')
        .textContent =
        indian(
          records
        );

    }

    if($('visualSelectedMetric')){

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

  function ensureMap(){

    if(
      indiaMap
      ||
      typeof L === 'undefined'
    ){

      return;

    }

    indiaMap =
      L.map(
        'salesIndiaMap',
        {

          zoomControl:true,

          minZoom:4,

          preferCanvas:true

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

        maxZoom:18,

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


  async function refreshMap(){

    const mapBox =
      $('salesIndiaMap');

    if(!mapBox){
      return;
    }

    try{

      installAllPincodesOption();

      ensureMapDetailsCard();

      ensureMap();

      const status =
        $('visualMapStatus');

      if(status){

        status.textContent =
          'Loading filtered Pincode sales...';

      }

      /*
        India Map intentionally continues
        to use MAIN DASHBOARD MONTH.
      */
      const [
        rows,
        lookup
      ] =
        await Promise.all(
          [

            getGroupData(
              'Pincode',
              'dashboard'
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
            (a,b) =>
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

      const mapped = [];

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

      for(
        const row
        of selectedRows
      ){

        const pin =
          String(
            row.label
          ).trim();

        const geo =
          lookup.get(
            pin
          );

        if(!geo){
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

        const circle =
          L.circleMarker(
            [
              geo.lat,
              geo.lng
            ],
            {

              radius,

              weight:2,

              opacity:.9,

              fillOpacity:.65

            }
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


        circle.bindPopup(
          `
            <div class="raj-map-popup">

              <strong>
                ${escapeHtml(pin)}
              </strong>

              <br>

              ${
                geo.area
                  ? `${escapeHtml(geo.area)}<br>`
                  : ''
              }

              ${
                geo.state
                  ? `${escapeHtml(geo.state)}<br>`
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
                ${indian(row.qty,2)}
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


      if(mapped.length){

        indiaMap.fitBounds(
          L.latLngBounds(
            mapped
          ),
          {

            padding:[
              30,
              30
            ],

            maxZoom:9

          }
        );

      }else{

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


      if(status){

        const dashboardMonths =
          selectedDashboardMonths();

        const pointText =
          limitValue === 'all'
            ? 'All Pincodes'
            : `Top ${limitValue} Pincodes`;

        status.textContent =
          `${pointText} • ${mapped.length} mapped • ${rows.length} filtered Pincode groups`
          +
          (
            dashboardMonths.length
              ? ` • Month: ${dashboardMonths.map(visualMonthName).join(', ')}`
              : ' • All Months / Total'
          );

      }

    }catch(error){

      console.error(
        'India map error:',
        error
      );

      if($('visualMapStatus')){

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
     ACTIVE VIEW REFRESH
  ===================================================== */

  async function refreshActiveVisual(){

    const mapActive =
      $('mapVisualPane')
        ?.classList
        .contains(
          'active'
        );

    if(mapActive){

      await refreshMap();

    }else{

      await refreshGraph();

    }

  }


  /* =====================================================
     GRAPH / MAP TAB
  ===================================================== */

  function switchVisual(mode){

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

    if(mode === 'map'){

      setTimeout(
        refreshMap,
        50
      );

    }else{

      setTimeout(
        refreshGraph,
        20
      );

    }

  }


  /* =====================================================
     EVENTS
  ===================================================== */

  function wireVisuals(){

    installAllPincodesOption();

    ensureMapDetailsCard();

    installGraphMonthSelector();


    /*
      Schema/months loads asynchronously in script.js,
      so populate again after startup.
    */
    setTimeout(
      populateGraphMonths,
      1000
    );

    setTimeout(
      populateGraphMonths,
      2000
    );


    document
      .querySelectorAll(
        '.visual-mode-btn'
      )
      .forEach(
        button => {

          button.addEventListener(
            'click',
            () =>
              switchVisual(
                button.dataset.visualMode
              )
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


    /*
      Independent Graph Month.
    */
    $('visualGraphMonth')
      ?.addEventListener(
        'change',
        refreshGraph
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
            () =>
              setTimeout(
                refreshActiveVisual,
                150
              )
          );

        }
      );


    /*
      Normal dashboard filters.

      They still affect Graph by SM, Company,
      Customer, OD, Area etc.

      Main dashboard Month does NOT control
      Graph Month because Graph has its own
      independent month selector.
    */
    document.addEventListener(
      'change',
      event => {

        if(
          event.target.closest(
            '#visualAnalysisPanel'
          )
        ){

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
        () =>
          setTimeout(
            refreshActiveVisual,
            700
          )
      );


    $('clearFilters')
      ?.addEventListener(
        'click',
        () =>
          setTimeout(
            refreshActiveVisual,
            500
          )
      );


    document.addEventListener(
      'click',
      event => {

        if(
          event.target.closest(
            '.multi-option input, [data-select-all], [data-unselect-all]'
          )
        ){

          setTimeout(
            refreshActiveVisual,
            500
          );

        }

      }
    );


    setTimeout(
      refreshGraph,
      1100
    );

  }


  /* =====================================================
     START
  ===================================================== */

  if(
    document.readyState
    ===
    'loading'
  ){

    document.addEventListener(
      'DOMContentLoaded',
      wireVisuals
    );

  }else{

    wireVisuals();

  }

})();

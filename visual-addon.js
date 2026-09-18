/* =========================================================
   RAJ AGENCIES - visual-addon.js - online45

   GRAPH
   - Month-wise separate bars
   - All Months = every month separate dataset
   - Single Graph Month = selected month only
   - Follows Analysis View
   - Follows all normal dashboard filters

   INDIA MAP
   - Kept unchanged
   - All Pincodes
   - Click Pincode details
   - Uses main dashboard Month filter
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

  let salesChart = null;
  let indiaMap = null;
  let mapLayer = null;
  let pinLookup = null;
  let graphRequestId = 0;

  const $ = id =>
    document.getElementById(id);


  /* =====================================================
     BASIC HELPERS
  ===================================================== */

  function number(value){

    const n = Number(value || 0);

    return Number.isFinite(n)
      ? n
      : 0;

  }


  function indian(value, digits = 0){

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
        number(value) / 10000000
      ).toFixed(1) + ' Cr';

    }

    if(n >= 100000){

      return (
        number(value) / 100000
      ).toFixed(1) + ' L';

    }

    if(n >= 1000){

      return (
        number(value) / 1000
      ).toFixed(1) + ' K';

    }

    return indian(value);

  }


  function escapeHtml(value){

    const div =
      document.createElement('div');

    div.textContent =
      String(value ?? '');

    return div.innerHTML;

  }


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


  function metricValue(row, metric){

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


  function metricText(value, metric){

    if(metric === 'taxable'){

      return rupees(value);

    }

    return indian(
      value,
      metric === 'qty'
        ? 2
        : 0
    );

  }


  /* =====================================================
     MONTHS
  ===================================================== */

  function availableMonths(){

    if(
      typeof months !== 'undefined'
      &&
      Array.isArray(months)
    ){

      return [...months];

    }

    return [];

  }


  function selectedDashboardMonths(){

    if(
      typeof selected !== 'undefined'
      &&
      Array.isArray(selected.month)
    ){

      return [...selected.month];

    }

    return [];

  }


  function installGraphMonthSelector(){

    const controls =
      document.querySelector(
        '#graphVisualPane .visual-controls'
      );

    if(!controls){
      return;
    }

    if(!$('visualGraphMonthField')){

      const wrapper =
        document.createElement('div');

      wrapper.id =
        'visualGraphMonthField';

      wrapper.className =
        'field';

      wrapper.innerHTML = `
        <label>Graph Month</label>

        <select id="visualGraphMonth">
          <option value="">
            All Months - Separate Bars
          </option>
        </select>
      `;

      controls.appendChild(
        wrapper
      );

      $('visualGraphMonth')
        ?.addEventListener(
          'change',
          refreshGraph
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

    const monthList =
      availableMonths();

    select.innerHTML = `
      <option value="">
        All Months - Separate Bars
      </option>
    `;

    monthList.forEach(month => {

      const option =
        document.createElement(
          'option'
        );

      option.value =
        month;

      option.textContent =
        visualMonthName(month);

      select.appendChild(option);

    });

    if(
      oldValue
      &&
      monthList.includes(oldValue)
    ){

      select.value =
        oldValue;

    }

  }


  function graphMonths(){

    const chosen =
      $('visualGraphMonth')
        ?.value
      ||
      '';

    if(chosen){

      return [chosen];

    }

    return availableMonths();

  }


  /* =====================================================
     RPC GROUP DATA
  ===================================================== */

  async function groupDataForMonths(
    view,
    monthList
  ){

    const calls =
      monthList.map(async month => {

        const rows =
          await rpc(
            'raj_group_summary',
            {
              ...args(),
              p_view:view,
              p_months:[month]
            }
          )
          ||
          [];

        return {
          month,
          rows
        };

      });

    return await Promise.all(calls);

  }


  async function mapGroupData(view){

    return await rpc(
      'raj_group_summary',
      {
        ...args(),
        p_view:view,
        p_months:selectedDashboardMonths()
      }
    )
    ||
    [];

  }


  /* =====================================================
     GRAPH
  ===================================================== */

  async function refreshGraph(){

    const canvas =
      $('salesVisualChart');

    if(
      !canvas
      ||
      typeof Chart === 'undefined'
    ){
      return;
    }

    const requestId =
      ++graphRequestId;

    try{

      populateGraphMonths();

      const view =
        typeof currentView !== 'undefined'
          ? currentView
          : 'Party';

      const metric =
        $('visualMetric')
          ?.value
        ||
        'taxable';

      const topN =
        Number(
          $('visualTopN')
            ?.value
          ||
          10
        );

      const selectedMonths =
        graphMonths();

      if(!selectedMonths.length){

        if($('visualChartNote')){

          $('visualChartNote')
            .textContent =
            'No months available';

        }

        return;

      }


      if($('visualChartNote')){

        $('visualChartNote')
          .textContent =
          'Loading month-wise graph...';

      }


      /*
        IMPORTANT:
        Separate RPC call for every month.
        This matches Analysis View month-wise logic.
      */
      const monthResults =
        await groupDataForMonths(
          view,
          selectedMonths
        );


      if(requestId !== graphRequestId){
        return;
      }


      /*
        Build one combined list of group names.
      */
      const allLabels =
        new Set();

      monthResults.forEach(result => {

        result.rows.forEach(row => {

          const label =
            String(
              row.label
              ??
              ''
            ).trim();

          if(label){

            allLabels.add(label);

          }

        });

      });


      /*
        Build month -> label -> row map.
      */
      const monthMaps =
        new Map();

      monthResults.forEach(result => {

        const rowMap =
          new Map();

        result.rows.forEach(row => {

          rowMap.set(
            String(
              row.label
              ??
              ''
            ).trim(),
            row
          );

        });

        monthMaps.set(
          result.month,
          rowMap
        );

      });


      /*
        Rank groups using sum of selected months
        for currently selected metric.
      */
      const rankedGroups =
        [...allLabels]
          .map(label => {

            let total = 0;

            selectedMonths.forEach(month => {

              const row =
                monthMaps
                  .get(month)
                  ?.get(label);

              if(row){

                total +=
                  metricValue(
                    row,
                    metric
                  );

              }

            });

            return {
              label,
              total
            };

          })
          .sort(
            (a,b) =>
              b.total - a.total
          )
          .slice(
            0,
            topN
          );


      const labels =
        rankedGroups.map(
          item => item.label
        );


      /*
        One dataset = one month.
        Therefore every month gets its own bar.
      */
      const datasets =
        selectedMonths.map(
          (month,index) => {

            const rowMap =
              monthMaps.get(month);

            const data =
              labels.map(label => {

                const row =
                  rowMap?.get(label);

                return row
                  ? metricValue(
                      row,
                      metric
                    )
                  : 0;

              });

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

              backgroundColor:color,

              borderColor:color,

              borderWidth:1.5,

              borderRadius:6,

              tension:.28,

              fill:false,

              pointRadius:4,

              pointHoverRadius:6

            };

          }
        );


      const chartType =
        $('visualChartType')
          ?.value
        ||
        'bar';


      if(salesChart){

        salesChart.destroy();

        salesChart = null;

      }


      salesChart =
        new Chart(
          canvas,
          {

            type:chartType,

            data:{
              labels,
              datasets
            },

            options:{

              responsive:true,

              maintainAspectRatio:false,

              animation:{
                duration:300
              },

              interaction:{
                mode:'nearest',
                intersect:false
              },

              plugins:{

                legend:{

                  display:true,

                  position:'top',

                  labels:{
                    usePointStyle:true,
                    boxWidth:9,
                    padding:16
                  }

                },

                tooltip:{

                  callbacks:{

                    label(context){

                      return (
                        context.dataset.label
                        +
                        ': '
                        +
                        metricText(
                          context.raw,
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

                      x:{

                        stacked:false,

                        grid:{
                          display:false
                        },

                        ticks:{
                          autoSkip:false,
                          maxRotation:45,
                          minRotation:0
                        }

                      },

                      y:{

                        stacked:false,

                        beginAtZero:true,

                        ticks:{

                          callback(value){

                            if(metric === 'taxable'){

                              return '₹'
                                +
                                compact(value);

                            }

                            return compact(value);

                          }

                        }

                      }

                    }

            }

          }
        );


      /*
        KPI DATA
      */

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
            allLabels.size
          );

      }


      const topGroup =
        rankedGroups[0]
        ||
        null;


      if($('visualTopGroup')){

        $('visualTopGroup')
          .textContent =
          topGroup
            ?.label
          ||
          '-';

      }


      /*
        Top Taxable Sale should use Taxable
        across selected graph months.
      */
      let topTaxableGroup = null;
      let topTaxableValue = -1;

      [...allLabels].forEach(label => {

        let totalTaxable = 0;

        selectedMonths.forEach(month => {

          const row =
            monthMaps
              .get(month)
              ?.get(label);

          if(row){

            totalTaxable +=
              number(
                row.taxable
              );

          }

        });

        if(totalTaxable > topTaxableValue){

          topTaxableValue =
            totalTaxable;

          topTaxableGroup =
            label;

        }

      });


      if($('visualTopSale')){

        $('visualTopSale')
          .textContent =
          rupees(
            Math.max(
              0,
              topTaxableValue
            )
          );

      }


      if($('visualChartTitle')){

        $('visualChartTitle')
          .textContent =
          selectedMonths.length > 1

            ? `Top ${Math.min(topN,labels.length)} ${VIEW_NAMES[view] || view} - Month Wise ${METRIC_NAMES[metric] || metric}`

            : `Top ${Math.min(topN,labels.length)} ${VIEW_NAMES[view] || view} - ${visualMonthName(selectedMonths[0])} ${METRIC_NAMES[metric] || metric}`;

      }


      if($('visualChartNote')){

        $('visualChartNote')
          .textContent =
          selectedMonths.length > 1

            ? `Separate Bars: ${selectedMonths.map(visualMonthName).join(', ')}`

            : `Graph Month: ${visualMonthName(selectedMonths[0])}`;

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

        values.push(value);

        value = '';

      }

      else{

        value += ch;

      }

    }

    values.push(value);

    return values;

  }


  async function loadPincodeLookup(){

    if(pinLookup){

      return pinLookup;

    }

    if($('visualMapStatus')){

      $('visualMapStatus')
        .textContent =
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
        .split(/\r?\n/)
        .filter(Boolean);

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
        Number(cols[4]);

      const lng =
        Number(cols[5]);

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
     ALL PINCODES
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
     PINCODE DETAILS CARD
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
          <span>Taxable Sales</span>
          <strong id="visualSelectedTaxable">-</strong>
        </div>

        <div class="visual-map-detail-item">
          <span>Customers Billed</span>
          <strong id="visualSelectedCustomers">-</strong>
        </div>

        <div class="visual-map-detail-item">
          <span>Quantity</span>
          <strong id="visualSelectedQty">-</strong>
        </div>

        <div class="visual-map-detail-item">
          <span>Products Sold</span>
          <strong id="visualSelectedProducts">-</strong>
        </div>

        <div class="visual-map-detail-item">
          <span>Records</span>
          <strong id="visualSelectedRecords">-</strong>
        </div>

        <div class="visual-map-detail-item">
          <span>Bubble Metric</span>
          <strong id="visualSelectedMetric">-</strong>
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


    if($('visualSelectedPin')){

      $('visualSelectedPin')
        .textContent =
        pin;

    }


    if($('visualMapDetailsLocation')){

      $('visualMapDetailsLocation')
        .textContent =
        location
        ||
        'Location not available';

    }


    if($('visualSelectedTaxable')){

      $('visualSelectedTaxable')
        .textContent =
        rupees(row.taxable);

    }


    if($('visualSelectedCustomers')){

      $('visualSelectedCustomers')
        .textContent =
        indian(customers);

    }


    if($('visualSelectedQty')){

      $('visualSelectedQty')
        .textContent =
        indian(row.qty,2);

    }


    if($('visualSelectedProducts')){

      $('visualSelectedProducts')
        .textContent =
        indian(products);

    }


    if($('visualSelectedRecords')){

      $('visualSelectedRecords')
        .textContent =
        indian(records);

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
        [22.8,79.0],
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
    .addTo(indiaMap);


    mapLayer =
      L.layerGroup()
        .addTo(indiaMap);

  }


  async function refreshMap(){

    if(!$('salesIndiaMap')){
      return;
    }

    try{

      installAllPincodesOption();

      ensureMapDetailsCard();

      ensureMap();


      if($('visualMapStatus')){

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

          .filter(row => {

            return /^\d{6}$/.test(
              String(
                row.label
                ||
                ''
              ).trim()
            );

          })

          .sort(
            (a,b) =>
              metricValue(b,metric)
              -
              metricValue(a,metric)
          );


      const selectedRows =
        limitValue === 'all'

          ? validRows

          : validRows.slice(
              0,
              Number(limitValue || 50)
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
          lookup.get(pin);


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
            Math.max(0,value)
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
              weight:2,
              opacity:.9,
              fillOpacity:.65
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
            padding:[30,30],
            maxZoom:9
          }
        );

      }else{

        indiaMap.setView(
          [22.8,79.0],
          5
        );

      }


      setTimeout(
        () =>
          indiaMap.invalidateSize(),
        100
      );


      if($('visualMapStatus')){

        const dashboardMonths =
          selectedDashboardMonths();


        const pointText =
          limitValue === 'all'
            ? 'All Pincodes'
            : `Top ${limitValue} Pincodes`;


        $('visualMapStatus')
          .textContent =

          `${pointText} • ${mapped.length} mapped • ${rows.length} filtered Pincode groups`

          +

          (
            dashboardMonths.length

              ? ` • Month: ${
                  dashboardMonths
                    .map(visualMonthName)
                    .join(', ')
                }`

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
     ACTIVE VISUAL
  ===================================================== */

  async function refreshActiveVisual(){

    const mapActive =
      $('mapVisualPane')
        ?.classList
        .contains('active');


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
      .forEach(button => {

        button.classList.toggle(
          'active',
          button.dataset.visualMode
          ===
          mode
        );

      });


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
        50
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
      script.js gets schema/months asynchronously,
      therefore populate again after startup.
    */
    setTimeout(
      populateGraphMonths,
      800
    );

    setTimeout(
      populateGraphMonths,
      1600
    );


    document
      .querySelectorAll(
        '.visual-mode-btn'
      )
      .forEach(button => {

        button.addEventListener(
          'click',
          () => {

            switchVisual(
              button.dataset.visualMode
            );

          }
        );

      });


    [
      'visualChartType',
      'visualTopN',
      'visualMetric'
    ]
    .forEach(id => {

      $(id)
        ?.addEventListener(
          'change',
          refreshGraph
        );

    });


    [
      'visualMapLimit',
      'visualMapMetric'
    ]
    .forEach(id => {

      $(id)
        ?.addEventListener(
          'change',
          refreshMap
        );

    });


    $('visualRefresh')
      ?.addEventListener(
        'click',
        refreshActiveVisual
      );


    document
      .querySelectorAll(
        '#viewTabs button'
      )
      .forEach(button => {

        button.addEventListener(
          'click',
          () => {

            setTimeout(
              refreshActiveVisual,
              150
            );

          }
        );

      });


    /*
      Main dashboard filter changes.
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
      1200
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

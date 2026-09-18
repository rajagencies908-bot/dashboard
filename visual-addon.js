/* =========================================================
   RAJ AGENCIES - visual-addon.js - online41
   GRAPH VIEW ONLY + MONTH FILTER FIX

   IMPORTANT:
   - India Map removed.
   - Graph follows current Analysis View.
   - Graph follows selected Month.
   - Graph follows all dashboard filters.
   - Bar / Line / Donut supported.
========================================================= */

(() => {

  'use strict';


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

  let visualBusy = false;


  const $ = id =>
    document.getElementById(id);



  /* =====================================================
     NUMBER HELPERS
  ===================================================== */

  function num(value){

    const n =
      Number(
        value
        ||
        0
      );


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

        maximumFractionDigits:
          digits

      }
    ).format(
      num(value)
    );

  }



  function rupees(value){

    return '₹'
      +
      new Intl.NumberFormat(
        'en-IN',
        {

          maximumFractionDigits:0

        }
      ).format(
        num(value)
      );

  }



  function compact(value){

    const n =
      Math.abs(
        num(value)
      );


    if(
      n
      >=
      10000000
    ){

      return (
        num(value)
        /
        10000000
      ).toFixed(1)
      +
      ' Cr';

    }


    if(
      n
      >=
      100000
    ){

      return (
        num(value)
        /
        100000
      ).toFixed(1)
      +
      ' L';

    }


    if(
      n
      >=
      1000
    ){

      return (
        num(value)
        /
        1000
      ).toFixed(1)
      +
      ' K';

    }


    return indian(
      value
    );

  }



  /* =====================================================
     NORMAL METRIC VALUE
  ===================================================== */

  function metricValue(
    row,
    metric
  ){

    if(
      metric
      ===
      'customers'
    ){

      return num(

        row.customersBilled

        ??

        row.customersbilled

      );

    }


    if(
      metric
      ===
      'products'
    ){

      return num(

        row.productsSold

        ??

        row.productssold

      );

    }


    return num(
      row[metric]
    );

  }



  function metricText(
    value,
    metric
  ){

    return metric
      ===
      'taxable'

      ? rupees(
          value
        )

      : indian(
          value,

          metric
            ===
            'qty'
            ? 2
            : 0
        );

  }



  /* =====================================================
     SELECTED MONTHS
  ===================================================== */

  function selectedVisualMonths(){

    if(
      typeof selected
      !==
      'undefined'

      &&

      Array.isArray(
        selected.month
      )
    ){

      return [
        ...selected.month
      ];

    }


    return [];

  }



  /* =====================================================
     GROUP DATA
  ===================================================== */

  async function getGroupData(view){

    const months =
      selectedVisualMonths();


    return await rpc(

      'raj_group_summary',

      {

        ...args(),

        p_view:
          view,

        /*
          IMPORTANT:

          Month is explicitly passed again here.

          This prevents Visual Analysis from
          accidentally using all-period totals.
        */

        p_months:
          months

      }

    )
    ||
    [];

  }



  /* =====================================================
     SELECTED MONTH METRIC
  ===================================================== */

  function selectedMonthMetric(
    row,
    metric
  ){

    const months =
      selectedVisualMonths();


    /*
      No month selected:
      use normal aggregate value.
    */

    if(
      !months.length
    ){

      return metricValue(
        row,
        metric
      );

    }


    /*
      Try to read month-specific values.

      Example:

      AugustTaxable
      AugustQty
      AugustCustomersBilled
    */

    const monthValues =

      months.map(

        month => {

          const key =
            String(
              month
              ||
              ''
            )
            .toLowerCase();


          let candidates = [];


          if(
            metric
            ===
            'taxable'
          ){

            candidates = [

              month
                +
                'Taxable',

              month
                +
                'taxable',

              key
                +
                'Taxable',

              key
                +
                'taxable'

            ];

          }


          else if(
            metric
            ===
            'qty'
          ){

            candidates = [

              month
                +
                'Qty',

              month
                +
                'qty',

              key
                +
                'Qty',

              key
                +
                'qty'

            ];

          }


          else if(
            metric
            ===
            'customers'
          ){

            candidates = [

              month
                +
                'CustomersBilled',

              month
                +
                'customersBilled',

              month
                +
                'customersbilled',

              key
                +
                'CustomersBilled',

              key
                +
                'customersBilled',

              key
                +
                'customersbilled'

            ];

          }


          for(
            const candidate
            of candidates
          ){

            if(
              Object
                .prototype
                .hasOwnProperty
                .call(
                  row,
                  candidate
                )
            ){

              return num(
                row[candidate]
              );

            }

          }


          return null;

        }

      );



    /*
      If month-specific fields exist,
      add selected months together.
    */

    if(

      monthValues.length

      &&

      monthValues.every(
        value =>
          value
          !==
          null
      )

    ){

      return monthValues.reduce(

        (
          total,
          value
        ) =>
          total
          +
          value,

        0

      );

    }



    /*
      Fallback:

      raj_group_summary already received
      p_months above.

      Therefore its aggregate value should
      already represent selected months.
    */

    return metricValue(
      row,
      metric
    );

  }



  /* =====================================================
     CHART COLORS
  ===================================================== */

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
        length:
          count
      },

      (
        _,
        i
      ) =>

        base[
          i
          %
          base.length
        ]

    );

  }



  /* =====================================================
     REFRESH GRAPH
  ===================================================== */

  async function refreshGraph(){

    if(
      visualBusy
    ){

      return;

    }


    const canvas =
      $(
        'salesVisualChart'
      );


    if(

      !canvas

      ||

      typeof Chart
      ===
      'undefined'

    ){

      return;

    }


    visualBusy =
      true;



    if(
      $('visualChartNote')
    ){

      $('visualChartNote')
        .textContent =
        'Loading graph...';

    }



    try{


      /* ---------------------------------------------
         CURRENT ANALYSIS VIEW
      --------------------------------------------- */

      const view =
        currentView
        ||
        'Party';



      /* ---------------------------------------------
         METRIC
      --------------------------------------------- */

      const metric =

        $('visualMetric')
          ?.value

        ||

        'taxable';



      /* ---------------------------------------------
         TOP COUNT
      --------------------------------------------- */

      const topN =

        Number(

          $('visualTopN')
            ?.value

          ||

          10

        );



      /* ---------------------------------------------
         GET FILTERED + MONTH FILTERED DATA
      --------------------------------------------- */

      const rows =

        await getGroupData(
          view
        );



      /* ---------------------------------------------
         SORT USING SELECTED MONTH VALUE
      --------------------------------------------- */

      const sorted =

        [
          ...rows
        ]
        .sort(

          (
            a,
            b
          ) =>

            selectedMonthMetric(
              b,
              metric
            )

            -

            selectedMonthMetric(
              a,
              metric
            )

        );



      /* ---------------------------------------------
         TOP ROWS
      --------------------------------------------- */

      const topRows =

        sorted.slice(
          0,
          topN
        );



      /* ---------------------------------------------
         LABELS
      --------------------------------------------- */

      const labels =

        topRows.map(

          row =>

            String(
              row.label
              ??
              ''
            )

        );



      /* ---------------------------------------------
         VALUES

         IMPORTANT:
         selectedMonthMetric() is used here.
      --------------------------------------------- */

      const values =

        topRows.map(

          row =>

            selectedMonthMetric(
              row,
              metric
            )

        );



      /* ---------------------------------------------
         CHART TYPE
      --------------------------------------------- */

      const chartType =

        $('visualChartType')
          ?.value

        ||

        'bar';



      const colors =

        palette(
          topRows.length
        );



      /* ---------------------------------------------
         DESTROY OLD CHART
      --------------------------------------------- */

      if(
        salesChart
      ){

        salesChart.destroy();

        salesChart =
          null;

      }



      /* ---------------------------------------------
         DATASET
      --------------------------------------------- */

      const dataset = {

        label:

          METRIC_NAMES[
            metric
          ]

          ||

          metric,


        data:
          values,


        borderWidth:
          2,


        borderRadius:

          chartType
          ===
          'bar'

            ? 8

            : 0,


        tension:

          chartType
          ===
          'line'

            ? .28

            : 0,


        fill:
          false

      };



      /* ---------------------------------------------
         DONUT
      --------------------------------------------- */

      if(
        chartType
        ===
        'doughnut'
      ){

        dataset.backgroundColor =
          colors;


        dataset.borderColor =
          '#ffffff';

      }



      /* ---------------------------------------------
         LINE
      --------------------------------------------- */

      else if(
        chartType
        ===
        'line'
      ){

        dataset.borderColor =
          '#6757f5';


        dataset.backgroundColor =
          '#6757f5';


        dataset.pointBackgroundColor =
          colors;

      }



      /* ---------------------------------------------
         BAR
      --------------------------------------------- */

      else{

        dataset.backgroundColor =
          colors;


        dataset.borderColor =
          colors;

      }



      /* =================================================
         CREATE CHART
      ================================================= */

      salesChart =

        new Chart(

          canvas,

          {

            type:
              chartType,


            data:{

              labels:
                labels,


              datasets:[
                dataset
              ]

            },


            options:{

              responsive:
                true,


              maintainAspectRatio:
                false,


              animation:{

                duration:
                  350

              },


              interaction:{

                mode:
                  'nearest',

                intersect:
                  false

              },


              plugins:{


                legend:{

                  display:

                    chartType
                    ===
                    'doughnut',


                  position:
                    'bottom'

                },


                tooltip:{

                  callbacks:{


                    label(
                      context
                    ){

                      const value =

                        context
                          .parsed
                          ?.y

                        ??

                        context
                          .parsed

                        ??

                        context
                          .raw;


                      return (

                        METRIC_NAMES[
                          metric
                        ]

                        +

                        ': '

                        +

                        metricText(
                          value,
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

                          autoSkip:
                            false,

                          maxRotation:
                            45,

                          minRotation:
                            0

                        },


                        grid:{

                          display:
                            false

                        }

                      },


                      y:{

                        beginAtZero:
                          true,


                        ticks:{

                          callback(
                            value
                          ){

                            return metric
                              ===
                              'taxable'

                              ? '₹'
                                +
                                compact(
                                  value
                                )

                              : compact(
                                  value
                                );

                          }

                        }

                      }

                    }

            }

          }

        );



      /* =================================================
         KPI - ANALYSIS VIEW
      ================================================= */

      if(
        $('visualViewName')
      ){

        $('visualViewName')
          .textContent =

          VIEW_NAMES[
            view
          ]

          ||

          view;

      }



      /* =================================================
         KPI - GROUP COUNT
      ================================================= */

      if(
        $('visualGroupCount')
      ){

        $('visualGroupCount')
          .textContent =

          indian(
            rows.length
          );

      }



      /* =================================================
         KPI - TOP GROUP
      ================================================= */

      if(
        $('visualTopGroup')
      ){

        $('visualTopGroup')
          .textContent =

          sorted[0]
            ?.label

          ||

          '-';

      }



      /* =================================================
         KPI - TOP TAXABLE SALE

         IMPORTANT:
         Selected month taxable is used.
      ================================================= */

      if(
        $('visualTopSale')
      ){

        $('visualTopSale')
          .textContent =

          rupees(

            sorted[0]

              ? selectedMonthMetric(
                  sorted[0],
                  'taxable'
                )

              : 0

          );

      }



      /* =================================================
         GRAPH TITLE
      ================================================= */

      if(
        $('visualChartTitle')
      ){

        $('visualChartTitle')
          .textContent =

          `Top ${
            Math.min(
              topN,
              rows.length
            )
          } ${
            VIEW_NAMES[
              view
            ]
            ||
            view
          } by ${
            METRIC_NAMES[
              metric
            ]
            ||
            metric
          }`;

      }



      /* =================================================
         SELECTED MONTH DISPLAY
      ================================================= */

      if(
        $('visualChartNote')
      ){

        const months =
          selectedVisualMonths();


        $('visualChartNote')
          .textContent =

          months.length

            ? `Selected Month: ${months.join(', ')}`

            : 'All selected dashboard data';

      }


    }

    catch(
      error
    ){


      console.error(
        'Visual graph error:',
        error
      );


      if(
        $('visualChartNote')
      ){

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

    finally{

      visualBusy =
        false;

    }

  }



  /* =====================================================
     EVENTS
  ===================================================== */

  function wireVisuals(){


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



    /* Refresh button */

    $('visualRefresh')
      ?.addEventListener(
        'click',
        refreshGraph
      );



    /* Analysis View change */

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
                refreshGraph,
                180
              )

          );

        }

      );



    /*
      Any normal dashboard filter change.

      This includes Month.
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
          refreshGraph,
          450
        );

      }

    );



    /* Global Search */

    $('search')
      ?.addEventListener(

        'input',

        () =>

          setTimeout(
            refreshGraph,
            750
          )

      );



    /* Clear Filters */

    $('clearFilters')
      ?.addEventListener(

        'click',

        () =>

          setTimeout(
            refreshGraph,
            550
          )

      );



    /*
      Multi-select dropdown changes.

      Month is a multi-select,
      so this is important.
    */

    document.addEventListener(

      'click',

      event => {


        if(
          event.target.closest(
            '.multi-option input, [data-select-all], [data-unselect-all]'
          )
        ){

          setTimeout(
            refreshGraph,
            550
          );

        }

      }

    );



    /* First graph load */

    setTimeout(
      refreshGraph,
      900
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

  }

  else{

    wireVisuals();

  }


})();

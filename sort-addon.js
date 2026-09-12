/* ============================================================
   RAJ DASHBOARD - SAFE SORT ADD-ON
   VERSION: online17-safe

   FIX:
   - NO MutationObserver
   - NO infinite browser loop
   - Detailed Sales default MainGrp A-Z
   - Detailed table server-side sorting
   - Analysis View client-side sorting
   ============================================================ */


/* ============================================================
   DETAILED TABLE SORT STATE
============================================================ */

let rajDetailSortColumn =
  'MainGrp';

let rajDetailSortDirection =
  'asc';


/* ============================================================
   ANALYSIS VIEW SORT STATE
============================================================ */

const rajAnalysisSortByView = {};


/* ============================================================
   SAVE ORIGINAL RPC
============================================================ */

const rajOriginalRpc =
  rpc;


/* ============================================================
   INTERCEPT ONLY DETAILED SALES ROW RPC

   Existing dashboard asks:
   raj_dashboard_rows

   We redirect it to:
   raj_dashboard_rows_sorted
============================================================ */

rpc =
  async function(
    name,
    params = {}
  ){


    if(
      name ===
      'raj_dashboard_rows'
    ){


      return await rajOriginalRpc(

        'raj_dashboard_rows_sorted',

        {

          ...params,


          p_sort_column:
            rajDetailSortColumn,


          p_sort_direction:
            rajDetailSortDirection

        }

      );


    }


    return await rajOriginalRpc(
      name,
      params
    );


  };


/* ============================================================
   HELPER:
   IS DETAILED COLUMN NUMERIC?
============================================================ */

function rajIsNumericDetailColumn(
  column
){


  const text =
    String(
      column || ''
    );


  if(
    text ===
    'Avg Sales'
  ){

    return true;

  }


  return (
    /Qty$/i.test(text)

    ||

    /Taxable$/i.test(text)

    ||

    /Amt$/i.test(text)

    ||

    /Sale$/i.test(text)

    ||

    /^Mobile$/i.test(text)

    ||

    /^Pincode$/i.test(text)
  );

}


/* ============================================================
   HELPER:
   IS ANALYSIS COLUMN NUMERIC?
============================================================ */

function rajIsNumericAnalysisHeader(
  text
){


  const value =
    String(
      text || ''
    );


  return (

    /Taxable Sale/i.test(value)

    ||

    /Avg/i.test(value)

    ||

    /^Qty$/i.test(value)

    ||

    /Products Sold/i.test(value)

    ||

    /Customers Billed/i.test(value)

    ||

    /^Records$/i.test(value)

    ||

    /^Total/i.test(value)

  );

}


/* ============================================================
   REMOVE OLD SORT SYMBOL
============================================================ */

function rajCleanHeaderText(
  text
){


  return String(
    text || ''
  )
    .replace(
      /\s*[▲▼↕]\s*$/g,
      ''
    )
    .trim();

}


/* ============================================================
   SORT SYMBOL
============================================================ */

function rajSortArrow(
  active,
  direction
){


  if(!active){

    return ' ↕';

  }


  return direction === 'asc'
    ? ' ▲'
    : ' ▼';

}


/* ============================================================
   DETAILED SALES HEADER UI
============================================================ */

function rajApplyDetailHeaderUI(){


  const head =
    document.getElementById(
      'tableHead'
    );


  if(!head){

    return;

  }


  const headers =
    [
      ...head.querySelectorAll(
        'th'
      )
    ];


  if(
    !headers.length
  ){

    return;

  }


  headers.forEach(

    (
      th,
      index
    ) => {


      const column =

        index <
        columns.length

          ? columns[index]

          : 'Avg Sales';


      const numeric =
        rajIsNumericDetailColumn(
          column
        );


      const active =

        column ===
        rajDetailSortColumn;


      /*
        Styling
      */

      th.style.cursor =
        'pointer';

      th.style.userSelect =
        'none';


      th.title =

        numeric

          ? 'Sort: Largest to Smallest / Smallest to Largest'

          : 'Sort: A to Z / Z to A';


      /*
        Header name
      */

      th.textContent =

        column

        +

        rajSortArrow(
          active,
          rajDetailSortDirection
        );


      /*
        Click sorting
      */

      th.onclick =
        async function(){


          /*
            Same column:
            toggle direction
          */

          if(
            rajDetailSortColumn
            ===
            column
          ){


            rajDetailSortDirection =

              rajDetailSortDirection
              ===
              'asc'

                ? 'desc'

                : 'asc';


          }else{


            /*
              New column
            */

            rajDetailSortColumn =
              column;


            /*
              Text:
              first click = A-Z

              Numeric:
              first click = Largest-Smallest
            */

            rajDetailSortDirection =

              numeric

                ? 'desc'

                : 'asc';


          }


          /*
            Always go to page 1
            when sort changes
          */

          page = 1;


          /*
            Update arrows immediately
          */

          rajApplyDetailHeaderUI();


          /*
            Reload data with
            server-side sorting
          */

          await loadDashboard(
            false
          );


          /*
            Re-apply header after load
          */

          rajApplyDetailHeaderUI();


        };


    }

  );


}


/* ============================================================
   ANALYSIS SORT STATE FOR CURRENT VIEW

   Customer Wise
   Company Wise
   Product Wise
   SM Wise
   Division Wise
   Pincode Wise

   Each view remembers own sorting.
============================================================ */

function rajGetAnalysisSortState(){


  const key =
    String(
      currentView ||
      'Party'
    );


  if(
    !rajAnalysisSortByView[key]
  ){


    rajAnalysisSortByView[key] = {

      columnIndex:0,

      direction:'asc'

    };


  }


  return rajAnalysisSortByView[key];

}


/* ============================================================
   MONEY / NUMBER TEXT -> NUMBER
============================================================ */

function rajParseNumber(
  text
){


  const cleaned =

    String(
      text || ''
    )

      .replace(
        /₹/g,
        ''
      )

      .replace(
        /,/g,
        ''
      )

      .replace(
        /%/g,
        ''
      )

      .replace(
        /\s/g,
        ''
      )

      .trim();


  const number =
    Number(
      cleaned
    );


  return Number.isFinite(
    number
  )

    ? number

    : 0;

}


/* ============================================================
   ANALYSIS VIEW SORT
============================================================ */

function rajApplyAnalysisSort(){


  const body =
    document.getElementById(
      'groupSummaryBody'
    );


  if(!body){

    return;

  }


  const table =
    body.closest(
      'table'
    );


  if(!table){

    return;

  }


  const headers =
    [
      ...table.querySelectorAll(
        'thead th'
      )
    ];


  const rows =
    [
      ...body.querySelectorAll(
        'tr'
      )
    ];


  if(
    !headers.length
    ||
    !rows.length
  ){

    return;

  }


  const state =
    rajGetAnalysisSortState();


  /*
    Safety if number of
    columns changed
  */

  if(
    state.columnIndex
    >=
    headers.length
  ){


    state.columnIndex =
      0;


    state.direction =
      'asc';

  }


  const activeHeaderText =

    rajCleanHeaderText(

      headers[
        state.columnIndex
      ]
        ?.textContent

    );


  const activeIsNumeric =

    rajIsNumericAnalysisHeader(
      activeHeaderText
    );


  /*
    SORT ROWS
  */

  rows.sort(

    function(
      rowA,
      rowB
    ){


      const cellA =

        rowA.children[
          state.columnIndex
        ];


      const cellB =

        rowB.children[
          state.columnIndex
        ];


      if(
        !cellA
        ||
        !cellB
      ){

        return 0;

      }


      let result = 0;


      /*
        Numeric
      */

      if(
        activeIsNumeric
      ){


        const valueA =
          rajParseNumber(
            cellA.textContent
          );


        const valueB =
          rajParseNumber(
            cellB.textContent
          );


        result =
          valueA
          -
          valueB;


      }else{


        /*
          Text A-Z
        */

        const valueA =

          String(
            cellA.textContent ||
            ''
          ).trim();


        const valueB =

          String(
            cellB.textContent ||
            ''
          ).trim();


        result =
          valueA.localeCompare(

            valueB,

            'en',

            {

              numeric:true,

              sensitivity:'base'

            }

          );


      }


      /*
        Direction
      */

      return (

        state.direction ===
        'asc'

          ? result

          : -result

      );


    }

  );


  /*
    Put sorted rows back
  */

  const fragment =
    document.createDocumentFragment();


  rows.forEach(
    row => {

      fragment.appendChild(
        row
      );

    }
  );


  body.appendChild(
    fragment
  );


  /*
    Setup clickable headers
  */

  headers.forEach(

    (
      th,
      index
    ) => {


      const baseText =

        rajCleanHeaderText(
          th.textContent
        );


      const numeric =

        rajIsNumericAnalysisHeader(
          baseText
        );


      const active =

        index ===
        state.columnIndex;


      th.style.cursor =
        'pointer';


      th.style.userSelect =
        'none';


      th.title =

        numeric

          ? 'Sort: Largest to Smallest / Smallest to Largest'

          : 'Sort: A to Z / Z to A';


      th.textContent =

        baseText

        +

        rajSortArrow(
          active,
          state.direction
        );


      th.onclick =
        function(){


          /*
            Same column
          */

          if(
            state.columnIndex
            ===
            index
          ){


            state.direction =

              state.direction
              ===
              'asc'

                ? 'desc'

                : 'asc';


          }else{


            /*
              New column
            */

            state.columnIndex =
              index;


            /*
              Numeric first click:
              Largest -> Smallest

              Text first click:
              A -> Z
            */

            state.direction =

              numeric

                ? 'desc'

                : 'asc';


          }


          rajApplyAnalysisSort();


        };


    }

  );


}


/* ============================================================
   WRAP EXISTING ANALYSIS FUNCTION

   Existing business logic remains unchanged.
============================================================ */

const rajOriginalLoadGroupSummary =
  loadGroupSummary;


loadGroupSummary =
  async function(){


    await rajOriginalLoadGroupSummary();


    /*
      Sort only AFTER original
      Analysis table is rendered
    */

    rajApplyAnalysisSort();


  };


/* ============================================================
   INITIAL SETUP
============================================================ */

document.addEventListener(

  'DOMContentLoaded',

  function(){


    /*
      Main script loads schema asynchronously,
      therefore Detailed headers may not exist yet.

      Safe polling only.
      NO MutationObserver.
    */


    let detailTries =
      0;


    const detailTimer =

      setInterval(

        function(){


          detailTries++;


          const headers =
            document.querySelectorAll(
              '#tableHead th'
            );


          if(
            headers.length > 0
          ){


            rajApplyDetailHeaderUI();


            clearInterval(
              detailTimer
            );


          }


          if(
            detailTries >= 100
          ){


            clearInterval(
              detailTimer
            );


          }


        },

        100

      );


    /*
      Analysis initial table
    */

    let analysisTries =
      0;


    const analysisTimer =

      setInterval(

        function(){


          analysisTries++;


          const rows =
            document.querySelectorAll(
              '#groupSummaryBody tr'
            );


          if(
            rows.length > 0
          ){


            rajApplyAnalysisSort();


            clearInterval(
              analysisTimer
            );


          }


          if(
            analysisTries >= 100
          ){


            clearInterval(
              analysisTimer
            );


          }


        },

        100

      );


  }

);

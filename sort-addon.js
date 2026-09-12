/* ============================================================
   RAJ DASHBOARD SORT ADD-ON

   Detailed Sales Data:
   - Default MainGrp A -> Z
   - Text columns: A -> Z / Z -> A
   - Numeric columns: Largest -> Smallest / Smallest -> Largest
   - Server-side sorting across all pages

   Analysis View:
   - Default first column A -> Z
   - Click any heading to sort
   ============================================================ */


let rajDetailSortColumn =
  'MainGrp';


let rajDetailSortDirection =
  'asc';


const rajAnalysisSortByView = {};



/* ============================================================
   REDIRECT DETAILED ROW RPC TO SORTED RPC
   ============================================================ */

const rajOriginalRpcFunction =
  rpc;


rpc =
  async function(
    name,
    params = {}
  ){


    if(name === 'raj_dashboard_rows'){


      return await rajOriginalRpcFunction(

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


    return await rajOriginalRpcFunction(
      name,
      params
    );


  };



/* ============================================================
   HELPERS
   ============================================================ */


function rajIsNumericDetailColumn(
  column
){


  if(column === 'Avg Sales'){

    return true;

  }


  return /Qty|Taxable|Amt|Sale|Mobile/i.test(
    String(
      column || ''
    )
  );


}



function rajIsNumericAnalysisHeader(
  text
){


  return /Sale|Qty|Products Sold|Customers Billed|Records|Average|Avg|Total/i.test(
    String(
      text || ''
    )
  );


}



function rajCleanHeaderText(
  text
){


  return String(
    text || ''
  )
    .replace(
      /\s+[▲▼↕]\s*$/,
      ''
    )
    .trim();


}



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
   DETAILED SALES DATA HEADER SORTING
   ============================================================ */


function rajApplyDetailHeaderUI(){


  const head =
    document.getElementById(
      'tableHead'
    );


  if(!head){

    return;

  }



  const ths =
    [
      ...head.querySelectorAll(
        'th'
      )
    ];



  ths.forEach(

    (
      th,
      index
    ) => {


      const column =

        index < columns.length

          ? columns[index]

          : 'Avg Sales';



      th.style.cursor =
        'pointer';


      th.style.userSelect =
        'none';



      th.title =

        rajIsNumericDetailColumn(
          column
        )

          ? 'Click: Largest to Smallest / Smallest to Largest'

          : 'Click: A to Z / Z to A';



      const active =

        column ===
        rajDetailSortColumn;



      th.textContent =

        column

        +

        rajSortArrow(

          active,

          rajDetailSortDirection

        );



      th.onclick =

        async () => {


          const numeric =

            rajIsNumericDetailColumn(
              column
            );



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


            rajDetailSortColumn =
              column;



            rajDetailSortDirection =

              numeric

                ? 'desc'

                : 'asc';


          }



          page = 1;



          rajApplyDetailHeaderUI();



          await loadDashboard(
            false
          );


        };


    }

  );


}



/* ============================================================
   ANALYSIS VIEW SORT STATE
   ============================================================ */


function rajAnalysisState(){


  const key =
    String(
      currentView || 'Party'
    );



  if(
    !rajAnalysisSortByView[key]
  ){


    rajAnalysisSortByView[key] = {

      index:0,

      direction:'asc'

    };


  }



  return rajAnalysisSortByView[key];


}



/* ============================================================
   CONVERT MONEY / NUMBER CELL TO NUMBER
   ============================================================ */


function rajParseNumber(
  text
){


  const clean =

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



  const value =
    Number(
      clean
    );



  return Number.isFinite(
    value
  )

    ? value

    : 0;


}



/* ============================================================
   ANALYSIS VIEW SORTING
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
    rajAnalysisState();



  if(
    state.index
    >=
    headers.length
  ){


    state.index =
      0;


    state.direction =
      'asc';


  }



  const headerText =

    rajCleanHeaderText(

      headers[
        state.index
      ]
        ?.textContent

    );



  const numeric =

    rajIsNumericAnalysisHeader(
      headerText
    );



  rows.sort(

    (
      a,
      b
    ) => {


      const aCell =
        a.children[
          state.index
        ];


      const bCell =
        b.children[
          state.index
        ];



      if(
        !aCell
        ||
        !bCell
      ){

        return 0;

      }



      let result = 0;



      if(numeric){


        result =

          rajParseNumber(
            aCell.textContent
          )

          -

          rajParseNumber(
            bCell.textContent
          );


      }else{


        result =

          String(
            aCell.textContent
            ||
            ''
          )

          .trim()

          .localeCompare(

            String(
              bCell.textContent
              ||
              ''
            )
            .trim(),

            'en',

            {

              numeric:true,

              sensitivity:'base'

            }

          );


      }



      return

        state.direction
        ===
        'asc'

          ? result

          : -result;


    }

  );



  rows.forEach(

    row =>

      body.appendChild(
        row
      )

  );



  headers.forEach(

    (
      th,
      index
    ) => {


      const base =

        rajCleanHeaderText(
          th.textContent
        );



      const isNumeric =

        rajIsNumericAnalysisHeader(
          base
        );



      th.style.cursor =
        'pointer';


      th.style.userSelect =
        'none';



      th.title =

        isNumeric

          ? 'Click: Largest to Smallest / Smallest to Largest'

          : 'Click: A to Z / Z to A';



      th.textContent =

        base

        +

        rajSortArrow(

          index === state.index,

          state.direction

        );



      th.onclick =

        () => {


          if(
            state.index
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


            state.index =
              index;



            state.direction =

              isNumeric

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
   ============================================================ */


const rajOriginalLoadGroupSummary =
  loadGroupSummary;



loadGroupSummary =

  async function(){


    await rajOriginalLoadGroupSummary();


    rajApplyAnalysisSort();


  };



/* ============================================================
   STARTUP OBSERVERS
   ============================================================ */


document.addEventListener(

  'DOMContentLoaded',

  () => {



    /* --------------------------------------------------------
       Detailed Data Header Observer
       -------------------------------------------------------- */

    const detailHead =

      document.getElementById(
        'tableHead'
      );



    if(detailHead){


      const detailObserver =

        new MutationObserver(

          () => {


            if(

              detailHead.querySelectorAll(
                'th'
              ).length

            ){


              rajApplyDetailHeaderUI();


            }


          }

        );



      detailObserver.observe(

        detailHead,

        {

          childList:true,

          subtree:true

        }

      );


    }



    /* --------------------------------------------------------
       Analysis View Observer
       -------------------------------------------------------- */

    const analysisBody =

      document.getElementById(
        'groupSummaryBody'
      );



    if(analysisBody){


      const analysisObserver =

        new MutationObserver(

          () => {


            queueMicrotask(
              rajApplyAnalysisSort
            );


          }

        );



      analysisObserver.observe(

        analysisBody,

        {

          childList:true,

          subtree:true

        }

      );


    }



    /* --------------------------------------------------------
       Wait until main script creates Detailed headers
       -------------------------------------------------------- */

    let tries = 0;



    const headerTimer =

      setInterval(

        () => {


          tries++;



          const ready =

            document.querySelectorAll(
              '#tableHead th'
            ).length
            >
            0;



          if(ready){


            rajApplyDetailHeaderUI();


            clearInterval(
              headerTimer
            );


          }else if(
            tries > 80
          ){


            clearInterval(
              headerTimer
            );


          }


        },

        100

      );


  }

);

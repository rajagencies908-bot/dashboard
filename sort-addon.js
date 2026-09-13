/* ============================================================
   RAJ DASHBOARD
   SAFE SORT + FAST PRODUCT ANALYSIS
   VERSION: online23

   FIXED:
   - Product Analysis timeout removed
   - Product Analysis now uses ONE RPC call
   - ItemCode is FIRST column
   - ItemName is SECOND column
   - Month-wise Taxable Sales
   - Detailed Sales sorting preserved
   - Analysis sorting preserved
   - No MutationObserver
   - No infinite loop
   ============================================================ */


/* ============================================================
   DETAILED SORT STATE
   ============================================================ */

let rajDetailSortColumn =
  'MainGrp';

let rajDetailSortDirection =
  'asc';


/* ============================================================
   ANALYSIS SORT STATE
   ============================================================ */

const rajAnalysisSortByView = {};


/* ============================================================
   SAVE ORIGINAL RPC
   ============================================================ */

const rajOriginalRpc =
  rpc;


/* ============================================================
   DETAILED SALES:
   REDIRECT NORMAL ROW RPC TO SORTED RPC
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
   HELPERS
   ============================================================ */

function rajEsc(value){

  const div =
    document.createElement(
      'div'
    );


  div.textContent =
    String(
      value ?? ''
    );


  return div.innerHTML;

}


function rajMoney(value){

  return '₹' +
    new Intl.NumberFormat(
      'en-IN',
      {
        minimumFractionDigits:2,
        maximumFractionDigits:2
      }
    ).format(
      Number(
        value || 0
      )
    );

}


function rajNumber(value){

  return new Intl.NumberFormat(
    'en-IN',
    {
      maximumFractionDigits:2
    }
  ).format(
    Number(
      value || 0
    )
  );

}


/* ============================================================
   SORT HELPERS
   ============================================================ */

function rajCleanHeaderText(text){

  return String(
    text || ''
  )
    .replace(
      /\s*[▲▼↕]\s*$/g,
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
   DETAILED SALES SORT UI
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

        index < columns.length

          ? columns[index]

          : 'Avg Sales';


      const numeric =
        rajIsNumericDetailColumn(
          column
        );


      const active =
        column ===
        rajDetailSortColumn;


      th.style.cursor =
        'pointer';


      th.style.userSelect =
        'none';


      th.title =

        numeric

          ? 'Sort: Largest to Smallest / Smallest to Largest'

          : 'Sort: A to Z / Z to A';


      th.textContent =

        column

        +

        rajSortArrow(
          active,
          rajDetailSortDirection
        );


      th.onclick =
        async function(){

          if(
            rajDetailSortColumn ===
            column
          ){

            rajDetailSortDirection =

              rajDetailSortDirection ===
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


          page =
            1;


          rajApplyDetailHeaderUI();


          await loadDashboard(
            false
          );


          rajApplyDetailHeaderUI();

        };

    }
  );

}


/* ============================================================
   ANALYSIS SORT STATE
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
   DISPLAY TEXT -> NUMBER
   ============================================================ */

function rajParseNumber(text){

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
   ANALYSIS SORT
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


  /*
    Don't sort placeholder/error row.
  */

  if(
    rows.length === 1
    &&
    rows[0].querySelector(
      '.empty'
    )
  ){

    return;

  }


  const state =
    rajGetAnalysisSortState();


  if(
    state.columnIndex >=
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


  rows.sort(
    (
      rowA,
      rowB
    ) => {

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


      let result =
        0;


      if(
        activeIsNumeric
      ){

        result =

          rajParseNumber(
            cellA.textContent
          )

          -

          rajParseNumber(
            cellB.textContent
          );


      }else{

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


      return state.direction ===
        'asc'

          ? result

          : -result;

    }
  );


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

          if(
            state.columnIndex ===
            index
          ){

            state.direction =

              state.direction ===
              'asc'

                ? 'desc'

                : 'asc';


          }else{

            state.columnIndex =
              index;


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
   MONTH TAXABLE VALUE FROM FAST PRODUCT RPC
   ============================================================ */

function rajProductMonthTaxable(
  row,
  month
){

  const key =
    String(
      month || ''
    )
      .toLowerCase();


  if(
    key === 'apr'
    ||
    key === 'april'
  ){

    return Number(
      row.aprtaxable
      ??
      row.AprTaxable
      ??
      0
    );

  }


  if(
    key === 'may'
  ){

    return Number(
      row.maytaxable
      ??
      row.MayTaxable
      ??
      0
    );

  }


  if(
    key === 'jun'
    ||
    key === 'june'
  ){

    return Number(
      row.junetaxable
      ??
      row.JuneTaxable
      ??
      0
    );

  }


  if(
    key === 'jul'
    ||
    key === 'july'
  ){

    return Number(
      row.jultaxable
      ??
      row.JulyTaxable
      ??
      0
    );

  }


  if(
    key === 'aug'
    ||
    key === 'august'
  ){

    return Number(
      row.augtaxable
      ??
      row.AugTaxable
      ??
      0
    );

  }


  if(
    key === 'sep'
    ||
    key === 'sept'
    ||
    key === 'september'
  ){

    return Number(
      row.septtaxable
      ??
      row.SeptTaxable
      ??
      0
    );

  }


  return 0;

}


/* ============================================================
   FAST PRODUCT WISE ANALYSIS
   ============================================================ */

async function rajLoadProductAnalysis(){

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


  const headRow =
    table
      ?.querySelector(
        'thead tr'
      );


  if(!headRow){

    return;

  }


  const analysisMonths =

    selected.month.length

      ? [...selected.month]

      : [...months];


  /* ========================================================
     BUILD HEADER
     ======================================================== */

  let header = `

    <th>
      ItemCode
    </th>

    <th>
      Product / Item Name
    </th>

  `;


  analysisMonths.forEach(
    month => {

      header += `

        <th>
          ${rajEsc(
            monthNames[month]
            ||
            month
          )}
          Taxable Sale
        </th>

      `;

    }
  );


  header += `

    <th>
      Avg Taxable Sale
    </th>

    <th>
      Qty
    </th>

    <th>
      Total Taxable Sale
    </th>

    <th>
      Products Sold
    </th>

    <th>
      Customers Billed
    </th>

    <th>
      Records
    </th>

  `;


  headRow.innerHTML =
    header;


  body.innerHTML = `

    <tr>

      <td
        class="empty"
        colspan="${
          analysisMonths.length
          +
          8
        }"
      >
        Loading Product Analysis...
      </td>

    </tr>

  `;


  try{

    /*
      args() already contains:
      - effective dashboard filters
      - role restricted SM
      - month selection
      - product sale status
      - search
    */

    const baseArgs =
      args();


    /*
      IMPORTANT:
      ONE RPC ONLY.

      Previous version made:
      Total + every month = many scans.

      This version performs
      one database scan.
    */

    const data =
      await rajOriginalRpc(
        'raj_product_analysis_fast',
        {

          p_filters:
            baseArgs.p_filters,

          p_months:
            baseArgs.p_months,

          p_sale_status:
            baseArgs.p_sale_status,

          p_search:
            baseArgs.p_search

        }
      );


    const rows =
      Array.isArray(data)
        ? data
        : [];


    if(
      !rows.length
    ){

      body.innerHTML = `

        <tr>

          <td
            class="empty"
            colspan="${
              analysisMonths.length
              +
              8
            }"
          >
            No summary data found.
          </td>

        </tr>

      `;


      return;

    }


    /* ======================================================
       BUILD PRODUCT ROWS
       ====================================================== */

    body.innerHTML =
      rows
        .map(
          row => {

            const itemCode =
              row.itemcode
              ??
              row.ItemCode
              ??
              '';


            const itemName =
              row.itemname
              ??
              row.ItemName
              ??
              '';


            const monthSales =
              analysisMonths.map(
                month =>
                  rajProductMonthTaxable(
                    row,
                    month
                  )
              );


            const avg =

              monthSales.length

                ? monthSales.reduce(
                    (
                      total,
                      value
                    ) =>
                      total + value,
                    0
                  )
                  /
                  monthSales.length

                : 0;


            const monthCells =
              monthSales
                .map(
                  value =>
                    `<td>${rajMoney(value)}</td>`
                )
                .join('');


            const qty =
              Number(
                row.qty
                ??
                row.Qty
                ??
                0
              );


            const taxable =
              Number(
                row.taxable
                ??
                row.Taxable
                ??
                0
              );


            const productsSold =
              Number(
                row.productssold
                ??
                row.ProductsSold
                ??
                0
              );


            const customersBilled =
              Number(
                row.customersbilled
                ??
                row.CustomersBilled
                ??
                0
              );


            const records =
              Number(
                row.records
                ??
                row.Records
                ??
                0
              );


            return `

              <tr>

                <td>
                  ${rajEsc(
                    itemCode
                  )}
                </td>

                <td>
                  ${rajEsc(
                    itemName
                  )}
                </td>

                ${monthCells}

                <td>
                  ${rajMoney(
                    avg
                  )}
                </td>

                <td>
                  ${rajNumber(
                    qty
                  )}
                </td>

                <td>
                  ${rajMoney(
                    taxable
                  )}
                </td>

                <td>
                  ${rajNumber(
                    productsSold
                  )}
                </td>

                <td>
                  ${rajNumber(
                    customersBilled
                  )}
                </td>

                <td>
                  ${rajNumber(
                    records
                  )}
                </td>

              </tr>

            `;

          }
        )
        .join('');


  }catch(error){

    console.error(
      'Fast Product Analysis Error:',
      error
    );


    body.innerHTML = `

      <tr>

        <td
          class="empty"
          colspan="${
            analysisMonths.length
            +
            8
          }"
        >
          Product Analysis error:
          ${rajEsc(
            error?.message
            ||
            error
          )}
        </td>

      </tr>

    `;

  }

}


/* ============================================================
   WRAP NORMAL ANALYSIS
   ============================================================ */

const rajOriginalLoadGroupSummary =
  loadGroupSummary;


loadGroupSummary =
  async function(){

    /*
      PRODUCT WISE:
      Use optimized ItemCode + ItemName report.
    */

    if(
      currentView ===
      'ItemName'
    ){

      await rajLoadProductAnalysis();


      rajApplyAnalysisSort();


      return;

    }


    /*
      CUSTOMER / COMPANY / SM /
      DIVISION / PINCODE:
      keep original dashboard logic.
    */

    await rajOriginalLoadGroupSummary();


    rajApplyAnalysisSort();

  };


/* ============================================================
   INITIAL SETUP
   ============================================================ */

document.addEventListener(
  'DOMContentLoaded',
  function(){

    /* --------------------------------------------------------
       Detailed Sales headers
       -------------------------------------------------------- */

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


    /* --------------------------------------------------------
       Analysis initial sort
       -------------------------------------------------------- */

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

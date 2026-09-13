/* ============================================================
   RAJ DASHBOARD - SAFE SORT + PRODUCT ANALYSIS ADDON
   VERSION: online22

   FEATURES:
   - NO MutationObserver
   - NO infinite browser loop
   - Detailed Sales default MainGrp A-Z
   - Detailed Sales server-side sorting
   - Analysis View client-side sorting
   - Product Wise:
       1st Column  = ItemCode
       2nd Column  = Product / Item Name
   ============================================================ */


/* ============================================================
   DETAILED TABLE SORT STATE
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
   INTERCEPT DETAILED SALES ROW RPC
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
   MONEY
============================================================ */

function rajMoney(value){

  return '₹' +
    new Intl.NumberFormat(
      'en-IN',
      {
        minimumFractionDigits:2,
        maximumFractionDigits:2
      }
    ).format(
      Number(value || 0)
    );

}


/* ============================================================
   NUMBER
============================================================ */

function rajNumber(value){

  return new Intl.NumberFormat(
    'en-IN',
    {
      maximumFractionDigits:2
    }
  ).format(
    Number(value || 0)
  );

}


/* ============================================================
   ESCAPE
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


/* ============================================================
   DETAIL NUMERIC COLUMN
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
   ANALYSIS NUMERIC HEADER
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
   CLEAN SORT SYMBOL
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
   SORT ARROW
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
   DETAILED SALES HEADER SORT
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


          page = 1;


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
   TEXT -> NUMBER
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
    Do not sort the
    "No summary data found"
    placeholder row.
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


      let result =
        0;


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
          valueA -
          valueB;


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


      return (

        state.direction ===
        'asc'

          ? result

          : -result

      );

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
   PRODUCT ROW KEY

   ItemCode + ItemName
============================================================ */

function rajProductKey(
  row
){

  const itemCode =
    String(
      row?.itemcode
      ??
      row?.ItemCode
      ??
      ''
    );


  const itemName =
    String(
      row?.itemname
      ??
      row?.ItemName
      ??
      ''
    );


  return (
    itemCode
    +
    '\u0001'
    +
    itemName
  );

}


/* ============================================================
   PRODUCT ANALYSIS ROW VALUES
============================================================ */

function rajProductQty(
  row
){

  return Number(
    row?.qty
    ??
    row?.Qty
    ??
    0
  );

}


function rajProductTaxable(
  row
){

  return Number(
    row?.taxable
    ??
    row?.Taxable
    ??
    0
  );

}


function rajProductProductsSold(
  row
){

  return Number(
    row?.productssold
    ??
    row?.productsSold
    ??
    row?.ProductsSold
    ??
    0
  );

}


function rajProductCustomersBilled(
  row
){

  return Number(
    row?.customersbilled
    ??
    row?.customersBilled
    ??
    row?.CustomersBilled
    ??
    0
  );

}


function rajProductRecords(
  row
){

  return Number(
    row?.records
    ??
    row?.Records
    ??
    0
  );

}


/* ============================================================
   PRODUCT WISE ANALYSIS

   FIRST COLUMN:
   ItemCode

   SECOND COLUMN:
   Product / Item Name
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


  /*
    Header
  */

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
          ${
            rajEsc(
              monthNames[month]
              ||
              month
            )
          }
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


  try{

    const baseArgs =
      args();


    const results =

      await Promise.all(
        [

          rajOriginalRpc(
            'raj_product_analysis',
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
          ),


          ...analysisMonths.map(
            month =>

              rajOriginalRpc(
                'raj_product_analysis',
                {
                  p_filters:
                    baseArgs.p_filters,

                  p_months:[
                    month
                  ],

                  p_sale_status:
                    baseArgs.p_sale_status,

                  p_search:
                    baseArgs.p_search
                }
              )

          )

        ]
      );


    const totalRows =
      Array.isArray(
        results[0]
      )
        ? results[0]
        : [];


    const monthlyRows =
      results.slice(1);


    if(
      !totalRows.length
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


    const monthMaps =

      monthlyRows.map(
        rows => {

          const map =
            new Map();


          (
            Array.isArray(rows)
              ? rows
              : []
          )
            .forEach(
              row => {

                map.set(
                  rajProductKey(row),
                  rajProductTaxable(row)
                );

              }
            );


          return map;

        }
      );


    body.innerHTML =

      totalRows
        .map(
          row => {

            const itemCode =
              row?.itemcode
              ??
              row?.ItemCode
              ??
              '';


            const itemName =
              row?.itemname
              ??
              row?.ItemName
              ??
              '';


            const key =
              rajProductKey(
                row
              );


            const monthSales =

              analysisMonths.map(
                (
                  month,
                  index
                ) =>

                  Number(
                    monthMaps[index]
                      ?.get(key)
                    ??
                    0
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


            return `

              <tr>

                <td>
                  ${rajEsc(itemCode)}
                </td>

                <td>
                  ${rajEsc(itemName)}
                </td>

                ${monthCells}

                <td>
                  ${rajMoney(avg)}
                </td>

                <td>
                  ${rajNumber(
                    rajProductQty(row)
                  )}
                </td>

                <td>
                  ${rajMoney(
                    rajProductTaxable(row)
                  )}
                </td>

                <td>
                  ${rajNumber(
                    rajProductProductsSold(row)
                  )}
                </td>

                <td>
                  ${rajNumber(
                    rajProductCustomersBilled(row)
                  )}
                </td>

                <td>
                  ${rajNumber(
                    rajProductRecords(row)
                  )}
                </td>

              </tr>

            `;

          }
        )
        .join('');


  }catch(error){

    console.error(
      'Product Analysis Error:',
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
   WRAP EXISTING ANALYSIS FUNCTION
============================================================ */

const rajOriginalLoadGroupSummary =
  loadGroupSummary;


loadGroupSummary =
  async function(){

    /*
      Product Wise gets its own
      ItemCode + ItemName report.
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
      All other Analysis tabs
      remain exactly as before.
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

    /*
      Detailed Sales headers
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
      Analysis table initial sort
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

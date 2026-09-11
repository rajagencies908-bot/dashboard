const { createClient } = supabase;

const sb = createClient(
  RAJ_CONFIG.supabaseUrl,
  RAJ_CONFIG.supabasePublishableKey
);

const filterDefs = [
  ['MainGrp', 'Main Group', 'All Main Groups'],
  ['ItemGroup', 'Item Group', 'All Item Groups'],
  ['Party', 'Customer / Party', 'All Customers'],
  ['ItemCode', 'Item Code', 'All Item Codes'],
  ['ItemName', 'Product / Item Name', 'All Products'],
  ['SM', 'SM', 'All SM'],
  ['Division', 'Division', 'All Divisions'],
  ['City', 'City', 'All Cities'],
  ['Pincode', 'Pincode', 'All Pincodes']
];

const filters = filterDefs.map(x => x[0]);

const selected = {};

filters.forEach(f => selected[f] = []);

selected.month = [];
selected.budgetOD = [];

let columns = [];
let months = [];

let page = 1;
let totalPages = 1;

let currentView = 'Party';

let timer = null;

let budgetPage = 1;
let budgetRows = [];

const budgetPageSize = 25;


/*
  OD customers list.

  OD products tableમાં નથી.

  એટલે:
  budget_customer.Order
  -> budget_customer.Party
  -> products.Party

  દ્વારા આખું dashboard filter થશે.
*/
let odParties = [];


/* ==============================
   FORMATTERS
============================== */

const fmt = n =>
  new Intl.NumberFormat(
    'en-IN',
    {
      maximumFractionDigits: 2
    }
  ).format(
    Number(n || 0)
  );


const money = n =>
  '₹' +
  new Intl.NumberFormat(
    'en-IN',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  ).format(
    Number(n || 0)
  );


const esc = v => {

  const d =
    document.createElement('div');

  d.textContent =
    v ?? '';

  return d.innerHTML;
};


/* ==============================
   MONTH NAMES
============================== */

const monthNames = {

  Jan: 'January',

  Feb: 'February',

  Mar: 'March',

  Apr: 'April',

  May: 'May',

  Jun: 'June',

  June: 'June',

  Jul: 'July',

  July: 'July',

  Aug: 'August',

  Sep: 'September',

  Sept: 'September',

  Oct: 'October',

  Nov: 'November',

  Dec: 'December'

};


/* ==============================
   BUDGET MONTH MAPPING
============================== */

const budgetMonthMap = {

  Apr: [
    'AprBudget',
    'AprSales',
    'AprDiff'
  ],

  May: [
    'MayBudget',
    'MaySales',
    'MayDiff'
  ],

  Jun: [
    'JuneBudget',
    'JuneSales',
    'JuneDiff'
  ],

  June: [
    'JuneBudget',
    'JuneSales',
    'JuneDiff'
  ],

  Jul: [
    'JulyBudget',
    'JulySales',
    'JulyDiff'
  ],

  July: [
    'JulyBudget',
    'JulySales',
    'JulyDiff'
  ],

  Aug: [
    'AugBudget',
    'AugSales',
    'AugDiff'
  ],

  Sep: [
    'SepBudget',
    'SepSales',
    'SepDiff'
  ],

  Sept: [
    'SepBudget',
    'SepSales',
    'SepDiff'
  ]

};


/* ==============================
   SUPABASE RPC
============================== */

async function rpc(
  name,
  params = {}
){

  const {
    data,
    error
  } =
    await sb.rpc(
      name,
      params
    );


  if(error){

    throw error;

  }


  return data;
}


/* ==============================
   SALES FILTER OBJECT
============================== */

function effectiveFilterObject(){

  const obj = {};


  /*
    બધા normal filters
  */

  for(
    const c of filters
  ){

    if(
      selected[c].length
    ){

      obj[c] =
        [...selected[c]];

    }

  }


  /*
    OD selected હોય તો
    ODના customers sales Party પર apply થશે.
  */

  if(
    selected.budgetOD.length
  ){

    let parties =
      odParties.map(
        String
      );


    /*
      જો customer/party પણ manually selected હોય,
      તો intersection લેવાશે.
    */

    if(
      selected.Party.length
    ){

      const allowed =
        new Set(
          parties
        );


      parties =
        selected.Party.filter(
          p =>
            allowed.has(
              String(p)
            )
        );

    }


    /*
      જો OD select કર્યું પણ
      matching customer જ ન મળે
      તો grand total ન આવવું જોઈએ.
    */

    obj.Party =
      parties.length
        ? parties
        : [
            '__RAJ_NO_MATCHING_PARTY__'
          ];

  }


  return obj;
}


/* ==============================
   MAIN DASHBOARD ARGUMENTS
============================== */

const args = () => ({

  p_filters:
    effectiveFilterObject(),

  p_months:
    selected.month,

  p_sale_status:
    document
      .getElementById(
        'productSaleStatus'
      )
      .value,

  p_search:
    document
      .getElementById(
        'search'
      )
      .value
      .trim()

});


/* ==============================
   CUSTOMER BUDGET ARGUMENTS
============================== */

const budgetArgs = () => ({

  p_sms:
    selected.SM.length
      ? selected.SM
      : null,

  p_cities:
    selected.City.length
      ? selected.City
      : null,

  p_pincodes:
    selected.Pincode.length
      ? selected.Pincode
      : null,

  p_divisions:
    selected.Division.length
      ? selected.Division
      : null,

  p_parties:
    selected.Party.length
      ? selected.Party
      : null,

  p_ods:
    selected.budgetOD.length
      ? selected.budgetOD
      : null,

  p_target_mode:
    document
      .getElementById(
        'budgetTarget'
      )
      .value,

  p_status:
    document
      .getElementById(
        'budgetStatus'
      )
      .value,

  p_months:
    selected.month.length
      ? selected.month
      : null

});


/* ==============================
   SELECT ALL / UNSELECT ALL
============================== */

function bulkButtons(id){

  return `

    <div
      style="
        display:flex;
        gap:8px;
        padding:8px 6px 10px;
        border-bottom:1px solid #e5e7eb;
        position:sticky;
        top:0;
        background:#fff;
        z-index:2;
      "
    >

      <button
        type="button"
        data-select-all="${id}"
        style="
          flex:1;
          padding:7px 9px;
          border:1px solid #cbd5e1;
          border-radius:8px;
          background:#f8fafc;
          cursor:pointer;
          font-weight:600;
        "
      >
        Select All
      </button>


      <button
        type="button"
        data-unselect-all="${id}"
        style="
          flex:1;
          padding:7px 9px;
          border:1px solid #cbd5e1;
          border-radius:8px;
          background:#f8fafc;
          cursor:pointer;
          font-weight:600;
        "
      >
        Unselect All
      </button>

    </div>

  `;
}


/* ==============================
   BUILD NORMAL FILTER UI
============================== */

function buildFilterUI(){

  document
    .getElementById(
      'filterGrid'
    )
    .innerHTML =

    filterDefs
      .map(
        (
          [
            id,
            label,
            all
          ]
        ) => `

          <div class="field">

            <label>
              ${label}
            </label>


            <div
              class="multi"
              id="multi_${id}"
            >

              <button
                type="button"
                class="multi-btn"
                data-open="${id}"
              >

                <span
                  id="label_${id}"
                >
                  ${all}
                </span>

                <span>
                  ▾
                </span>

              </button>


              <div class="multi-menu">

                <input
                  class="multi-search"
                  id="search_${id}"
                  placeholder="Search ${label}..."
                >


                <div
                  class="multi-options"
                  id="options_${id}"
                ></div>

              </div>

            </div>


            <div
              class="selected-chips"
              id="chips_${id}"
            ></div>

          </div>

        `
      )
      .join('');

}


/* ==============================
   UPDATE NORMAL FILTER LABEL
============================== */

function updateMultiLabel(
  column
){

  const def =
    filterDefs.find(
      x =>
        x[0] === column
    );


  document
    .getElementById(
      'label_' + column
    )
    .textContent =

    selected[column].length

      ? `${selected[column].length} selected`

      : def[2];


  document
    .getElementById(
      'chips_' + column
    )
    .innerHTML =

    selected[column]
      .slice(
        0,
        4
      )
      .map(
        v =>
          `<span class="chip">
            ${esc(v)}
          </span>`
      )
      .join('')

    +

    (
      selected[column].length > 4

        ? `<span class="chip">
            +${selected[column].length - 4}
          </span>`

        : ''
    );

}


/* ==============================
   UPDATE MONTH LABEL
============================== */

function updateMonthLabel(){

  document
    .getElementById(
      'label_month'
    )
    .textContent =

    selected.month.length

      ? `${selected.month.length} selected`

      : 'All Months / Total';


  document
    .getElementById(
      'chips_month'
    )
    .innerHTML =

    selected.month

      .map(
        v =>
          `<span class="chip">
            ${esc(
              monthNames[v] || v
            )}
          </span>`
      )

      .join('');

}


/* ==============================
   UPDATE OD LABEL
============================== */

function updateODLabel(){

  document
    .getElementById(
      'label_budgetOD'
    )
    .textContent =

    selected.budgetOD.length

      ? `${selected.budgetOD.length} selected`

      : 'All OD';


  document
    .getElementById(
      'chips_budgetOD'
    )
    .innerHTML =

    selected.budgetOD

      .slice(
        0,
        4
      )

      .map(
        v =>
          `<span class="chip">
            ${esc(v)}
          </span>`
      )

      .join('')

    +

    (
      selected.budgetOD.length > 4

        ? `<span class="chip">
            +${selected.budgetOD.length - 4}
          </span>`

        : ''
    );

}


/* ==============================
   GET ALL CHECKBOX VALUES
============================== */

function valuesFromOptions(
  id
){

  return [

    ...document
      .querySelectorAll(
        `#options_${id} input[type="checkbox"]`
      )

  ].map(
    x =>
      x.value
  );

}


/* ==============================
   SELECT ALL / UNSELECT ALL
============================== */

async function applyBulkSelection(
  id,
  selectAll
){

  /*
    MONTH
  */

  if(
    id === 'month'
  ){

    selected.month =
      selectAll

        ? valuesFromOptions(
            'month'
          )

        : [];


    document
      .querySelectorAll(
        '#options_month input[type="checkbox"]'
      )
      .forEach(
        x =>
          x.checked =
            selectAll
      );


    updateMonthLabel();


    page = 1;
    budgetPage = 1;


    await loadDashboard(
      true
    );


    return;
  }


  /*
    OD
  */

  if(
    id === 'budgetOD'
  ){

    selected.budgetOD =
      selectAll

        ? valuesFromOptions(
            'budgetOD'
          )

        : [];


    document
      .querySelectorAll(
        '#options_budgetOD input[type="checkbox"]'
      )
      .forEach(
        x =>
          x.checked =
            selectAll
      );


    updateODLabel();


    await refreshODPartyScope();


    page = 1;
    budgetPage = 1;


    await loadDashboard(
      true
    );


    return;
  }


  /*
    NORMAL FILTERS
  */

  if(
    !filters.includes(id)
  ){

    return;

  }


  selected[id] =
    selectAll

      ? valuesFromOptions(id)

      : [];


  document
    .querySelectorAll(
      `#options_${id} input[type="checkbox"]`
    )
    .forEach(
      x =>
        x.checked =
          selectAll
    );


  updateMultiLabel(id);


  page = 1;
  budgetPage = 1;


  await loadDashboard(
    true
  );

}


/* ==============================
   BUILD MONTH FILTER
============================== */

function buildMonths(){

  const box =
    document
      .getElementById(
        'options_month'
      );


  box.innerHTML =

    bulkButtons(
      'month'
    )

    +

    months
      .map(
        m => `

          <label
            class="multi-option"
            data-text="${esc(
              (
                monthNames[m] || m
              ).toLowerCase()
            )}"
          >

            <input
              type="checkbox"
              value="${esc(m)}"
              ${
                selected.month
                  .includes(
                    String(m)
                  )
                  ? 'checked'
                  : ''
              }
            >


            <span>
              ${esc(
                monthNames[m] || m
              )}
            </span>

          </label>

        `
      )
      .join('');


  box
    .querySelectorAll(
      'input[type="checkbox"]'
    )
    .forEach(
      c => {

        c.onchange =
          async () => {

            if(
              c.checked
            ){

              if(
                !selected.month
                  .includes(
                    c.value
                  )
              ){

                selected.month
                  .push(
                    c.value
                  );

              }

            }else{

              selected.month =
                selected.month
                  .filter(
                    x =>
                      x !== c.value
                  );

            }


            updateMonthLabel();


            page = 1;
            budgetPage = 1;


            await loadDashboard(
              true
            );

          };

      }
    );

}


/* ==============================
   LOAD NORMAL FILTER VALUES
============================== */

async function loadFilter(
  column
){

  const data =
    await rpc(
      'raj_filter_values',
      {

        p_column:
          column,

        ...args()

      }
    );


  const box =
    document
      .getElementById(
        'options_' + column
      );


  box.innerHTML =

    bulkButtons(
      column
    )

    +

    (data || [])

      .map(
        v => `

          <label
            class="multi-option"
            data-text="${esc(
              String(v)
                .toLowerCase()
            )}"
          >

            <input
              type="checkbox"
              value="${esc(v)}"
              ${
                selected[column]
                  .includes(
                    String(v)
                  )
                  ? 'checked'
                  : ''
              }
            >


            <span>
              ${esc(v)}
            </span>

          </label>

        `
      )

      .join('');


  box
    .querySelectorAll(
      'input[type="checkbox"]'
    )
    .forEach(
      x => {

        x.onchange =
          async () => {

            if(
              x.checked
            ){

              if(
                !selected[column]
                  .includes(
                    x.value
                  )
              ){

                selected[column]
                  .push(
                    x.value
                  );

              }

            }else{

              selected[column] =
                selected[column]
                  .filter(
                    v =>
                      v !== x.value
                  );

            }


            updateMultiLabel(
              column
            );


            page = 1;
            budgetPage = 1;


            await loadDashboard(
              true
            );

          };

      }
    );

}


/* ==============================
   REFRESH ALL NORMAL FILTERS
============================== */

async function refreshFilters(){

  for(
    const column of filters
  ){

    await loadFilter(
      column
    );

  }

}


/* ==============================
   LOAD OD OPTIONS
============================== */

async function loadODOptions(){

  const data =
    await rpc(
      'raj_budget_od_values'
    );


  const box =
    document
      .getElementById(
        'options_budgetOD'
      );


  box.innerHTML =

    bulkButtons(
      'budgetOD'
    )

    +

    (data || [])

      .map(
        row => `

          <label
            class="multi-option"
            data-text="${esc(
              String(row.OD)
                .toLowerCase()
            )}"
          >

            <input
              type="checkbox"
              value="${esc(
                row.OD
              )}"
              ${
                selected.budgetOD
                  .includes(
                    String(row.OD)
                  )
                  ? 'checked'
                  : ''
              }
            >


            <span>
              ${esc(
                row.OD
              )}
            </span>

          </label>

        `
      )

      .join('');


  box
    .querySelectorAll(
      'input[type="checkbox"]'
    )
    .forEach(
      input => {

        input.onchange =
          async () => {

            if(
              input.checked
            ){

              if(
                !selected.budgetOD
                  .includes(
                    input.value
                  )
              ){

                selected.budgetOD
                  .push(
                    input.value
                  );

              }

            }else{

              selected.budgetOD =
                selected.budgetOD
                  .filter(
                    v =>
                      v !== input.value
                  );

            }


            updateODLabel();


            /*
              selected ODના customer
              Party list refresh.
            */

            await refreshODPartyScope();


            /*
              આખું dashboard reload.
            */

            page = 1;
            budgetPage = 1;


            await loadDashboard(
              true
            );

          };

      }
    );

}


/* ==============================
   OD -> PARTY LIST
============================== */

async function refreshODPartyScope(){

  if(
    !selected.budgetOD.length
  ){

    odParties = [];

    return;

  }


  const data =
    await rpc(
      'raj_budget_od_parties',
      {

        p_ods:
          selected.budgetOD

      }
    );


  odParties =
    (data || [])

      .map(
        r =>
          String(
            r.Party || ''
          ).trim()
      )

      .filter(
        Boolean
      );

}


/* ==============================
   MONTH CARDS
============================== */

function renderMonths(
  monthData
){

  document
    .getElementById(
      'monthlyCards'
    )
    .innerHTML =

    months

      .map(
        month => {

          const a =
            monthData?.[month]
            || {};


          return `

            <div class="month-card">

              <h4>
                ${esc(
                  monthNames[month]
                  || month
                )}
              </h4>


              <div class="metric">

                <span>
                  Qty
                </span>

                <b>
                  ${fmt(
                    a.Qty
                  )}
                </b>

              </div>


              <div class="metric">

                <span>
                  Taxable
                </span>

                <b>
                  ${money(
                    a.Taxable
                  )}
                </b>

              </div>


              <div class="metric">

                <span>
                  Sale
                </span>

                <b>
                  ${money(
                    a.Sale
                  )}
                </b>

              </div>


              <div class="metric">

                <span>
                  Products Sold
                </span>

                <b>
                  ${fmt(
                    a.ProductsSold
                  )}
                </b>

              </div>


              <div class="metric">

                <span>
                  Customers Billed
                </span>

                <b>
                  ${fmt(
                    a.CustomersBilled
                  )}
                </b>

              </div>

            </div>

          `;

        }
      )

      .join('');

}


/* ==============================
   DETAIL SALES TABLE
============================== */

function renderRows(
  rows
){

  const body =
    document
      .getElementById(
        'tableBody'
      );


  if(
    !rows?.length
  ){

    body.innerHTML = `

      <tr>

        <td
          class="empty"
          colspan="${columns.length}"
        >

          No matching data found.

        </td>

      </tr>

    `;


    return;

  }


  body.innerHTML =

    rows

      .map(
        row =>

          '<tr>'

          +

          columns

            .map(
              column =>

                `<td>${
                  esc(

                    /Qty|Taxable|Amt|Sale$/
                      .test(
                        column
                      )

                      ? fmt(
                          row[column]
                        )

                      : (
                          row[column]
                          ?? ''
                        )

                  )
                }</td>`

            )

            .join('')

          +

          '</tr>'

      )

      .join('');

}


/* ==============================
   ANALYSIS VIEW
============================== */

async function loadGroupSummary(){

  const data =
    await rpc(
      'raj_group_summary',
      {

        p_view:
          currentView,

        ...args()

      }
    );


  const body =
    document
      .getElementById(
        'groupSummaryBody'
      );


  if(
    !data?.length
  ){

    body.innerHTML =

      '<tr><td class="empty" colspan="7">No summary data found.</td></tr>';


    return;

  }


  body.innerHTML =

    data

      .map(
        x => `

          <tr>

            <td>
              ${esc(
                x.label
              )}
            </td>


            <td>
              ${fmt(
                x.qty
              )}
            </td>


            <td>
              ${money(
                x.taxable
              )}
            </td>


            <td>
              ${money(
                x.sale
              )}
            </td>


            <td>
              ${fmt(
                x.productsSold
              )}
            </td>


            <td>
              ${fmt(
                x.customersBilled
              )}
            </td>


            <td>
              ${fmt(
                x.records
              )}
            </td>

          </tr>

        `
      )

      .join('');

}


/* ==============================
   BUDGET MONTHS
============================== */

function budgetMonthsToShow(){

  const chosen =

    selected.month.length

      ? selected.month

      : months;


  const normalized = [];


  for(
    const month of chosen
  ){

    const key =

      month === 'Sept'

        ? 'Sep'

        : month === 'June'

          ? 'Jun'

          : month === 'July'

            ? 'Jul'

            : month;


    if(
      budgetMonthMap[key] &&
      !normalized.includes(
        key
      )
    ){

      normalized.push(
        key
      );

    }

  }


  return normalized;
}


/* ==============================
   DIFF COLOR
============================== */

function diffClass(
  value
){

  return Number(
    value || 0
  ) < 0

    ? 'budget-negative'

    : 'budget-positive';

}


/* ==============================
   RENDER BUDGET
============================== */

function renderBudget(){

  const panel =
    document
      .getElementById(
        'budgetPanel'
      );


  /*
    Customer budget
    Company Wise અને Product Wiseમાં
    intentionally hidden.
  */

  if(
    currentView === 'MainGrp'
    ||
    currentView === 'ItemName'
  ){

    panel.classList.add(
      'budget-hidden'
    );


    return;

  }else{

    panel.classList.remove(
      'budget-hidden'
    );

  }


  const showMonths =
    budgetMonthsToShow();


  const multiSelected =
    selected.month.length > 1;


  let head =

    '<th>SM</th>'

    +

    '<th>Customer / Party</th>'

    +

    '<th>Target</th>'

    +

    '<th>OD</th>';


  showMonths.forEach(
    month => {

      const name =
        monthNames[month]
        || month;


      head +=

        `<th>
          ${name} Sales
        </th>`

        +

        `<th>
          ${name} Budget
        </th>`

        +

        `<th>
          ${name} Diff
        </th>`;

    }
  );


  if(
    multiSelected
    ||
    !selected.month.length
  ){

    head +=

      '<th>Total Sales</th>'

      +

      '<th>Total Budget</th>'

      +

      '<th>Total Diff</th>'

      +

      '<th>Achievement %</th>'

      +

      '<th>Status</th>';

  }


  document
    .getElementById(
      'budgetTableHead'
    )
    .innerHTML =
      head;


  document
    .getElementById(
      'budgetCount'
    )
    .textContent =
      fmt(
        budgetRows.length
      );


  const totalBudgetPages =

    Math.max(

      1,

      Math.ceil(
        budgetRows.length
        /
        budgetPageSize
      )

    );


  budgetPage =

    Math.min(

      budgetPage,

      totalBudgetPages

    );


  const rows =

    budgetRows.slice(

      (
        budgetPage - 1
      )
      *
      budgetPageSize,

      budgetPage
      *
      budgetPageSize

    );


  const body =
    document
      .getElementById(
        'budgetTableBody'
      );


  if(
    !rows.length
  ){

    body.innerHTML = `

      <tr>

        <td
          class="empty"
          colspan="${
            4
            +
            showMonths.length * 3
            +
            5
          }"
        >

          No matching budget customers found.

        </td>

      </tr>

    `;

  }else{

    body.innerHTML =

      rows

        .map(
          row => {

            let cells =

              `<td>
                ${esc(
                  row.SalesMan || ''
                )}
              </td>`

              +

              `<td>
                ${esc(
                  row.Party || ''
                )}
              </td>`

              +

              `<td>
                ${esc(
                  row.Target || ''
                )}
              </td>`

              +

              `<td>
                ${esc(
                  row.Order || ''
                )}
              </td>`;


            showMonths.forEach(
              month => {

                const [

                  budgetKey,
                  salesKey,
                  diffKey

                ] =
                  budgetMonthMap[
                    month
                  ];


                cells +=

                  `<td>
                    ${money(
                      row[salesKey]
                    )}
                  </td>`

                  +

                  `<td>
                    ${money(
                      row[budgetKey]
                    )}
                  </td>`

                  +

                  `<td class="${
                    diffClass(
                      row[diffKey]
                    )
                  }">

                    ${money(
                      row[diffKey]
                    )}

                  </td>`;

              }
            );


            if(
              multiSelected
              ||
              !selected.month.length
            ){

              cells +=

                `<td>
                  ${money(
                    row.SelectedSales
                  )}
                </td>`

                +

                `<td>
                  ${money(
                    row.SelectedBudget
                  )}
                </td>`

                +

                `<td class="${
                  diffClass(
                    row.Difference
                  )
                }">

                  ${money(
                    row.Difference
                  )}

                </td>`

                +

                `<td>
                  ${fmt(
                    row.AchievementPct
                  )}%
                </td>`

                +

                `<td>

                  <span
                    class="budget-status ${
                      row.BudgetStatus
                      ===
                      'ACHIEVED'

                        ? 'ok'

                        : 'bad'
                    }"
                  >

                    ${esc(
                      row.BudgetStatus
                      || ''
                    )}

                  </span>

                </td>`;

            }


            return `

              <tr>
                ${cells}
              </tr>

            `;

          }
        )

        .join('');

  }


  document
    .getElementById(
      'budgetPageInfo'
    )
    .textContent =

      `Page ${budgetPage} of ${totalBudgetPages} • ${fmt(
        budgetRows.length
      )} customers`;


  document
    .getElementById(
      'budgetPrev'
    )
    .disabled =

      budgetPage <= 1;


  document
    .getElementById(
      'budgetNext'
    )
    .disabled =

      budgetPage
      >=
      totalBudgetPages;


  document
    .getElementById(
      'budgetNote'
    )
    .textContent =

      selected.month.length

        ? `Showing ${
            selected.month
              .map(
                m =>
                  monthNames[m]
                  || m
              )
              .join(', ')
          } budget vs actual sales.`

        : 'No month selected: showing all available months side-by-side.';

}


/* ==============================
   LOAD BUDGET
============================== */

async function loadBudget(){

  if(
    currentView === 'MainGrp'
    ||
    currentView === 'ItemName'
  ){

    renderBudget();

    return;

  }


  const loading =
    document
      .getElementById(
        'budgetLoading'
      );


  loading.classList.add(
    'show'
  );


  try{

    budgetRows =

      await rpc(

        'raj_customer_budget_report',

        budgetArgs()

      )

      || [];


    renderBudget();

  }catch(error){

    console.error(
      error
    );


    document
      .getElementById(
        'budgetTableBody'
      )
      .innerHTML =

        `<tr>

          <td class="empty">

            Budget error:
            ${esc(
              error.message
            )}

          </td>

        </tr>`;

  }finally{

    loading.classList.remove(
      'show'
    );

  }

}


/* ==============================
   MAIN DASHBOARD LOAD
============================== */

async function loadDashboard(
  reload = false
){

  const loading =
    document
      .getElementById(
        'loading'
      );


  loading.classList.add(
    'show'
  );


  try{

    const a =
      args();


    const [

      summaryResult,
      rowsResult

    ] =

      await Promise.all([

        rpc(
          'raj_dashboard_summary',
          a
        ),

        rpc(
          'raj_dashboard_rows',
          {

            ...a,

            p_page:
              page,

            p_page_size:

              Number(

                document
                  .getElementById(
                    'pageSize'
                  )
                  .value

              )

          }
        )

      ]);


    const summary =
      summaryResult.summary
      || {};


    document
      .getElementById(
        'totalQty'
      )
      .textContent =

        fmt(
          summary.TotalQty
        );


    document
      .getElementById(
        'totalTaxable'
      )
      .textContent =

        money(
          summary.TotalTaxable
        );


    document
      .getElementById(
        'totalSale'
      )
      .textContent =

        money(
          summary.TotalSale
        );


    document
      .getElementById(
        'productsSold'
      )
      .textContent =

        fmt(
          summary.ProductsSold
        );


    document
      .getElementById(
        'customersBilled'
      )
      .textContent =

        fmt(
          summary.CustomersBilled
        );


    document
      .getElementById(
        'recordCount'
      )
      .textContent =

        fmt(
          rowsResult.totalRows
        );


    renderMonths(
      summaryResult.monthly
    );


    renderRows(
      rowsResult.rows
    );


    page =
      rowsResult.page;


    totalPages =
      rowsResult.totalPages;


    document
      .getElementById(
        'pageInfo'
      )
      .textContent =

        `Page ${page} of ${totalPages} • ${fmt(
          rowsResult.totalRows
        )} records`;


    document
      .getElementById(
        'prevPage'
      )
      .disabled =

        page <= 1;


    document
      .getElementById(
        'nextPage'
      )
      .disabled =

        page >= totalPages;


    if(
      reload
    ){

      await refreshFilters();

      buildMonths();

    }


    await Promise.all([

      loadGroupSummary(),

      loadBudget()

    ]);


  }catch(error){

    console.error(
      error
    );


    alert(

      'Dashboard error: '

      +

      error.message

    );

  }finally{

    loading.classList.remove(
      'show'
    );

  }

}


/* ==============================
   SEARCH INSIDE MULTI SELECT
============================== */

function wireSearchBox(
  id
){

  const el =
    document
      .getElementById(
        'search_' + id
      );


  if(
    !el
  ){

    return;

  }


  el.oninput =
    event => {

      const text =

        event.target.value
          .toLowerCase();


      document
        .querySelectorAll(
          `#options_${id} .multi-option`
        )
        .forEach(
          option => {

            option.style.display =

              option.dataset.text
                .includes(
                  text
                )

                ? 'flex'

                : 'none';

          }
        );

    };

}


/* ==============================
   PAGE START
============================== */

document.addEventListener(
  'DOMContentLoaded',
  async () => {

    try{

      /*
        Build filter UI
      */

      buildFilterUI();


      /*
        Get schema
      */

      const schema =
        await rpc(
          'raj_dashboard_schema'
        );


      columns =
        schema.columns
        || [];


      months =
        schema.months
        || [];


      /*
        Detailed table columns
      */

      document
        .getElementById(
          'tableHead'
        )
        .innerHTML =

          columns

            .map(
              column =>
                `<th>
                  ${esc(column)}
                </th>`
            )

            .join('');


      /*
        Month filter
      */

      buildMonths();


      /*
        Open / close dropdown
        Select All / Unselect All
      */

      document.addEventListener(
        'click',
        event => {

          /*
            SELECT ALL
          */

          const selectAllButton =

            event.target.closest(
              '[data-select-all]'
            );


          if(
            selectAllButton
          ){

            event.preventDefault();

            event.stopPropagation();


            applyBulkSelection(

              selectAllButton
                .dataset
                .selectAll,

              true

            );


            return;

          }


          /*
            UNSELECT ALL
          */

          const unselectAllButton =

            event.target.closest(
              '[data-unselect-all]'
            );


          if(
            unselectAllButton
          ){

            event.preventDefault();

            event.stopPropagation();


            applyBulkSelection(

              unselectAllButton
                .dataset
                .unselectAll,

              false

            );


            return;

          }


          /*
            OPEN DROPDOWN
          */

          const button =

            event.target.closest(
              '[data-open]'
            );


          if(
            button
          ){

            const box =

              document
                .getElementById(
                  'multi_'
                  +
                  button.dataset.open
                );


            document
              .querySelectorAll(
                '.multi.open'
              )
              .forEach(
                x => {

                  if(
                    x !== box
                  ){

                    x.classList.remove(
                      'open'
                    );

                  }

                }
              );


            box.classList.toggle(
              'open'
            );


            return;

          }


          /*
            CLICK OUTSIDE CLOSE
          */

          if(
            !event.target.closest(
              '.multi'
            )
          ){

            document
              .querySelectorAll(
                '.multi.open'
              )
              .forEach(
                x =>
                  x.classList.remove(
                    'open'
                  )
              );

          }

        }
      );


      /*
        Normal filter searches
      */

      for(
        const [id] of filterDefs
      ){

        wireSearchBox(
          id
        );

      }


      /*
        Month search
      */

      wireSearchBox(
        'month'
      );


      /*
        OD search
      */

      wireSearchBox(
        'budgetOD'
      );


      /*
        Initial data
      */

      await refreshFilters();

      await loadODOptions();

      await loadDashboard();


      /*
        Product sale status
      */

      document
        .getElementById(
          'productSaleStatus'
        )
        .onchange =

        async () => {

          page = 1;

          await loadDashboard(
            true
          );

        };


      /*
        Budget Status
      */

      document
        .getElementById(
          'budgetStatus'
        )
        .onchange =

        async () => {

          budgetPage = 1;

          await loadBudget();

        };


      /*
        Budget Target
      */

      document
        .getElementById(
          'budgetTarget'
        )
        .onchange =

        async () => {

          budgetPage = 1;

          await loadBudget();

        };


      /*
        Global Search
      */

      document
        .getElementById(
          'search'
        )
        .oninput =

        () => {

          clearTimeout(
            timer
          );


          timer =
            setTimeout(

              async () => {

                page = 1;


                await loadDashboard(
                  true
                );

              },

              350

            );

        };


      /*
        Page Size
      */

      document
        .getElementById(
          'pageSize'
        )
        .onchange =

        async () => {

          page = 1;

          await loadDashboard();

        };


      /*
        Previous Sales Page
      */

      document
        .getElementById(
          'prevPage'
        )
        .onclick =

        async () => {

          if(
            page > 1
          ){

            page--;

            await loadDashboard();

          }

        };


      /*
        Next Sales Page
      */

      document
        .getElementById(
          'nextPage'
        )
        .onclick =

        async () => {

          if(
            page < totalPages
          ){

            page++;

            await loadDashboard();

          }

        };


      /*
        Budget Previous
      */

      document
        .getElementById(
          'budgetPrev'
        )
        .onclick =

        () => {

          if(
            budgetPage > 1
          ){

            budgetPage--;

            renderBudget();

          }

        };


      /*
        Budget Next
      */

      document
        .getElementById(
          'budgetNext'
        )
        .onclick =

        () => {

          const pages =

            Math.max(

              1,

              Math.ceil(

                budgetRows.length
                /
                budgetPageSize

              )

            );


          if(
            budgetPage < pages
          ){

            budgetPage++;

            renderBudget();

          }

        };


      /*
        CLEAR ALL FILTERS
      */

      document
        .getElementById(
          'clearFilters'
        )
        .onclick =

        async () => {

          document
            .getElementById(
              'search'
            )
            .value = '';


          /*
            Month
          */

          selected.month = [];


          /*
            OD
          */

          selected.budgetOD = [];

          odParties = [];


          /*
            Product Sale
          */

          document
            .getElementById(
              'productSaleStatus'
            )
            .value =
              'All';


          /*
            Budget Status
          */

          document
            .getElementById(
              'budgetStatus'
            )
            .value =
              'all';


          /*
            Budget Target
          */

          document
            .getElementById(
              'budgetTarget'
            )
            .value =
              'all';


          /*
            All normal filters
          */

          filters.forEach(
            column => {

              selected[column] = [];

              updateMultiLabel(
                column
              );

            }
          );


          updateMonthLabel();

          updateODLabel();


          page = 1;

          budgetPage = 1;


          buildMonths();


          await loadODOptions();

          await refreshFilters();

          await loadDashboard();

        };


      /*
        ANALYSIS TABS
      */

      document
        .querySelectorAll(
          '#viewTabs button'
        )
        .forEach(
          button => {

            button.onclick =
              async () => {

                document
                  .querySelectorAll(
                    '#viewTabs button'
                  )
                  .forEach(
                    x =>
                      x.classList.remove(
                        'active'
                      )
                  );


                button.classList.add(
                  'active'
                );


                currentView =
                  button.dataset.view;


                document
                  .getElementById(
                    'viewLabel'
                  )
                  .textContent =

                    ({

                      Party:
                        'Customer / Party',

                      MainGrp:
                        'Company / Main Group',

                      ItemName:
                        'Product / Item Name',

                      SM:
                        'SM',

                      Division:
                        'Division',

                      Pincode:
                        'Pincode'

                    })[
                      currentView
                    ]

                    || currentView;


                await Promise.all([

                  loadGroupSummary(),

                  loadBudget()

                ]);

              };

          }
        );


    }catch(error){

      console.error(
        error
      );


      alert(

        'Startup error: '

        +

        error.message

        +

        '\nRun required Supabase SQL functions first.'

      );

    }

  }
);

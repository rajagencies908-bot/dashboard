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
const searchState = {};

filters.forEach(f => {
  selected[f] = [];
  searchState[f] = '';
});

selected.month = [];
selected.budgetOD = [];

searchState.month = '';
searchState.budgetOD = '';

let columns = [];
let months = [];

let page = 1;
let totalPages = 1;

let currentView = 'Party';

let timer = null;

let budgetPage = 1;
let budgetRows = [];

let odParties = [];

const budgetPageSize = 25;


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


const el =
  id =>
    document.getElementById(id);


const fmt =
  n =>
    new Intl.NumberFormat(
      'en-IN',
      {
        maximumFractionDigits: 2
      }
    ).format(
      Number(n || 0)
    );


const money =
  n =>
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


const esc =
  v => {

    const d =
      document.createElement('div');

    d.textContent =
      v ?? '';

    return d.innerHTML;

  };


async function rpc(
  name,
  params = {}
) {

  const {
    data,
    error
  } =
    await sb.rpc(
      name,
      params
    );


  if (error) {

    throw error;

  }


  return data;

}


/* =========================================
   EFFECTIVE FILTER OBJECT
========================================= */

function effectiveFilterObject() {

  const obj = {};


  for (
    const c of filters
  ) {

    if (
      selected[c].length
    ) {

      obj[c] =
        [...selected[c]];

    }

  }


  /*
    OD selected હોય તો
    budget_customer Party list
    sales Party filterમાં apply થશે.
  */

  if (
    selected.budgetOD.length
  ) {

    let parties =
      odParties.map(
        String
      );


    /*
      Party manually selected હોય તો
      OD Party + selected Party intersection.
    */

    if (
      selected.Party.length
    ) {

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
      OD selected but no matching Party:
      grand total ન આવવો જોઈએ.
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


/* =========================================
   DASHBOARD ARGUMENTS
========================================= */

const args =
  () => ({

    p_filters:
      effectiveFilterObject(),

    p_months:
      selected.month,

    p_sale_status:

      el('productSaleStatus')

        ? el('productSaleStatus').value

        : 'All',

    p_search:

      el('search')

        ? el('search').value.trim()

        : ''

  });


/* =========================================
   BUDGET ARGUMENTS
========================================= */

const budgetArgs =
  () => ({

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

      el('budgetTarget')

        ? el('budgetTarget').value

        : 'all',

    p_status:

      el('budgetStatus')

        ? el('budgetStatus').value

        : 'all',

    p_months:

      selected.month.length

        ? selected.month

        : null

  });


/* =========================================
   SELECT ALL / UNSELECT ALL BUTTONS
========================================= */

function bulkButtons(id) {

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
        z-index:5;
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


/* =========================================
   BUILD FILTER UI
========================================= */

function buildFilterUI() {

  const grid =
    el('filterGrid');


  if (!grid) {

    return;

  }


  grid.innerHTML =

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


/* =========================================
   UPDATE NORMAL FILTER LABEL
========================================= */

function updateMultiLabel(
  column
) {

  const def =
    filterDefs.find(
      x =>
        x[0] === column
    );


  const label =
    el(
      'label_' + column
    );


  const chips =
    el(
      'chips_' + column
    );


  if (label) {

    label.textContent =

      selected[column].length

        ? `${selected[column].length} selected`

        : def[2];

  }


  if (chips) {

    chips.innerHTML =

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

}


/* =========================================
   UPDATE MONTH LABEL
========================================= */

function updateMonthLabel() {

  const label =
    el('label_month');


  const chips =
    el('chips_month');


  if (label) {

    label.textContent =

      selected.month.length

        ? `${selected.month.length} selected`

        : 'All Months / Total';

  }


  if (chips) {

    chips.innerHTML =

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

}


/* =========================================
   UPDATE OD LABEL
========================================= */

function updateODLabel() {

  const label =
    el('label_budgetOD');


  const chips =
    el('chips_budgetOD');


  if (label) {

    label.textContent =

      selected.budgetOD.length

        ? `${selected.budgetOD.length} selected`

        : 'All OD';

  }


  if (chips) {

    chips.innerHTML =

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

}


/* =========================================
   GET CHECKBOX VALUES
========================================= */

function valuesFromOptions(
  id
) {

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


/* =========================================
   STABLE SEARCH
========================================= */

function applySearchFilter(
  id
) {

  const search =
    el(
      'search_' + id
    );


  if (!search) {

    return;

  }


  const text =

    (
      searchState[id]
      ??
      search.value
      ??
      ''
    )

      .toLowerCase()

      .trim();


  search.value =
    searchState[id]
    ??
    search.value
    ??
    '';


  document
    .querySelectorAll(
      `#options_${id} .multi-option`
    )
    .forEach(
      option => {

        const optionText =

          String(
            option.dataset.text || ''
          )
            .toLowerCase();


        option.style.display =

          optionText.includes(
            text
          )

            ? 'flex'

            : 'none';

      }
    );

}


/* =========================================
   KEEP FILTER OPEN AFTER SELECTION
========================================= */

function restoreOpenFilter(
  id
) {

  const search =
    el(
      'search_' + id
    );


  const multi =
    el(
      'multi_' + id
    );


  if (search) {

    search.value =
      searchState[id]
      || '';

  }


  applySearchFilter(
    id
  );


  if (multi) {

    multi.classList.add(
      'open'
    );

  }


  if (search) {

    requestAnimationFrame(
      () => {

        search.focus();


        const len =
          search.value.length;


        try {

          search.setSelectionRange(
            len,
            len
          );

        } catch (_) {

        }

      }
    );

  }

}


/* =========================================
   SEARCH INPUT EVENT
========================================= */

function wireSearchBox(
  id
) {

  const search =
    el(
      'search_' + id
    );


  if (!search) {

    return;

  }


  search.value =
    searchState[id]
    || '';


  search.oninput =
    () => {

      searchState[id] =
        search.value;


      applySearchFilter(
        id
      );

    };

}


/* =========================================
   SELECT ALL / UNSELECT ALL
========================================= */

async function applyBulkSelection(
  id,
  selectAll
) {

  /*
    MONTH
  */

  if (
    id === 'month'
  ) {

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


    restoreOpenFilter(
      'month'
    );


    return;

  }


  /*
    OD
  */

  if (
    id === 'budgetOD'
  ) {

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


    restoreOpenFilter(
      'budgetOD'
    );


    return;

  }


  /*
    NORMAL FILTER
  */

  if (
    !filters.includes(id)
  ) {

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


  updateMultiLabel(
    id
  );


  page = 1;
  budgetPage = 1;


  await loadDashboard(
    true
  );


  restoreOpenFilter(
    id
  );

}


/* =========================================
   BUILD MONTH FILTER
========================================= */

function buildMonths() {

  const box =
    el(
      'options_month'
    );


  if (!box) {

    return;

  }


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
                monthNames[m]
                || m
              )
                .toLowerCase()
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
                monthNames[m]
                || m
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
      checkbox => {

        checkbox.onchange =
          async () => {

            if (
              checkbox.checked
            ) {

              if (
                !selected.month
                  .includes(
                    checkbox.value
                  )
              ) {

                selected.month
                  .push(
                    checkbox.value
                  );

              }

            } else {

              selected.month =

                selected.month
                  .filter(
                    x =>
                      x !==
                      checkbox.value
                  );

            }


            updateMonthLabel();


            page = 1;
            budgetPage = 1;


            await loadDashboard(
              true
            );


            restoreOpenFilter(
              'month'
            );

          };

      }
    );


  applySearchFilter(
    'month'
  );

}


/* =========================================
   LOAD NORMAL FILTER
========================================= */

async function loadFilter(
  column
) {

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
    el(
      'options_' + column
    );


  if (!box) {

    return;

  }


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
      checkbox => {

        checkbox.onchange =
          async () => {

            if (
              checkbox.checked
            ) {

              if (
                !selected[column]
                  .includes(
                    checkbox.value
                  )
              ) {

                selected[column]
                  .push(
                    checkbox.value
                  );

              }

            } else {

              selected[column] =

                selected[column]
                  .filter(
                    v =>
                      v !==
                      checkbox.value
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


            /*
              હવે search text stable રહેશે,
              dropdown open રહેશે.
            */

            restoreOpenFilter(
              column
            );

          };

      }
    );


  /*
    Filter reload થયા પછી
    typed search ફરી apply.
  */

  applySearchFilter(
    column
  );

}


/* =========================================
   REFRESH FILTERS
========================================= */

async function refreshFilters() {

  for (
    const column of filters
  ) {

    await loadFilter(
      column
    );

  }

}


/* =========================================
   LOAD OD OPTIONS
========================================= */

async function loadODOptions() {

  const box =
    el(
      'options_budgetOD'
    );


  if (!box) {

    return;

  }


  const data =

    await rpc(
      'raj_budget_od_values'
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
              String(
                row.OD
              ).toLowerCase()
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
                    String(
                      row.OD
                    )
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
      checkbox => {

        checkbox.onchange =
          async () => {

            if (
              checkbox.checked
            ) {

              if (
                !selected.budgetOD
                  .includes(
                    checkbox.value
                  )
              ) {

                selected.budgetOD
                  .push(
                    checkbox.value
                  );

              }

            } else {

              selected.budgetOD =

                selected.budgetOD
                  .filter(
                    v =>
                      v !==
                      checkbox.value
                  );

            }


            updateODLabel();


            await refreshODPartyScope();


            page = 1;
            budgetPage = 1;


            await loadDashboard(
              true
            );


            restoreOpenFilter(
              'budgetOD'
            );

          };

      }
    );


  applySearchFilter(
    'budgetOD'
  );

}


/* =========================================
   OD -> PARTY LIST
========================================= */

async function refreshODPartyScope() {

  if (
    !selected.budgetOD.length
  ) {

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
        row =>
          String(
            row.Party
            || ''
          ).trim()
      )

      .filter(
        Boolean
      );

}


/* =========================================
   MONTH SUMMARY CARDS
========================================= */

function renderMonths(
  monthData
) {

  const container =
    el(
      'monthlyCards'
    );


  if (!container) {

    return;

  }


  container.innerHTML =

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


/* =========================================
   DETAIL TABLE
========================================= */

function renderRows(
  rows
) {

  const body =
    el(
      'tableBody'
    );


  if (!body) {

    return;

  }


  if (
    !rows?.length
  ) {

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


/* =========================================
   ANALYSIS VIEW
   MONTH WISE SALE
========================================= */

async function loadGroupSummary() {

  const body =
    el(
      'groupSummaryBody'
    );


  if (!body) {

    return;

  }


  const table =
    body.closest(
      'table'
    );


  if (!table) {

    return;

  }


  const headRow =
    table.querySelector(
      'thead tr'
    );


  if (!headRow) {

    return;

  }


  const analysisMonths =

    selected.month.length

      ? selected.month

      : months;


  try {

    const totalPromise =

      rpc(
        'raj_group_summary',
        {

          p_view:
            currentView,

          ...args()

        }
      );


    const monthPromises =

      analysisMonths

        .map(
          month =>

            rpc(
              'raj_group_summary',
              {

                p_view:
                  currentView,

                ...args(),

                p_months:
                  [month]

              }
            )

        );


    const results =

      await Promise.all([

        totalPromise,

        ...monthPromises

      ]);


    const totalData =
      results[0]
      || [];


    const monthlyData =
      results.slice(1);


    const viewName =

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


    let header =

      `<th id="viewLabel">
        ${esc(
          viewName
        )}
      </th>`;


    analysisMonths.forEach(
      month => {

        header +=

          `<th>
            ${esc(
              monthNames[month]
              || month
            )}
            Sale
          </th>`;

      }
    );


    header +=

      '<th>Qty</th>'

      +

      '<th>Taxable</th>'

      +

      '<th>Total Sale</th>'

      +

      '<th>Products Sold</th>'

      +

      '<th>Customers Billed</th>'

      +

      '<th>Records</th>';


    headRow.innerHTML =
      header;


    if (
      !totalData.length
    ) {

      body.innerHTML = `

        <tr>

          <td
            class="empty"
            colspan="${
              7
              +
              analysisMonths.length
            }"
          >

            No summary data found.

          </td>

        </tr>

      `;


      return;

    }


    const monthMaps =

      monthlyData

        .map(
          rows => {

            const map =
              new Map();


            (rows || [])

              .forEach(
                row => {

                  map.set(

                    String(
                      row.label
                    ),

                    Number(
                      row.sale
                      || 0
                    )

                  );

                }
              );


            return map;

          }
        );


    body.innerHTML =

      totalData

        .map(
          row => {

            let monthCells =
              '';


            analysisMonths

              .forEach(
                (
                  month,
                  index
                ) => {

                  const monthSale =

                    monthMaps[index]
                      ?.get(
                        String(
                          row.label
                        )
                      )

                    || 0;


                  monthCells +=

                    `<td>
                      ${money(
                        monthSale
                      )}
                    </td>`;

                }
              );


            return `

              <tr>

                <td>
                  ${esc(
                    row.label
                  )}
                </td>


                ${monthCells}


                <td>
                  ${fmt(
                    row.qty
                  )}
                </td>


                <td>
                  ${money(
                    row.taxable
                  )}
                </td>


                <td>
                  ${money(
                    row.sale
                  )}
                </td>


                <td>
                  ${fmt(
                    row.productsSold
                  )}
                </td>


                <td>
                  ${fmt(
                    row.customersBilled
                  )}
                </td>


                <td>
                  ${fmt(
                    row.records
                  )}
                </td>

              </tr>

            `;

          }
        )

        .join('');


  } catch (error) {

    console.error(
      'Analysis View Error:',
      error
    );


    body.innerHTML = `

      <tr>

        <td class="empty">

          Analysis error:
          ${esc(
            error.message
          )}

        </td>

      </tr>

    `;

  }

}


/* =========================================
   BUDGET MONTHS
========================================= */

function budgetMonthsToShow() {

  const chosen =

    selected.month.length

      ? selected.month

      : months;


  const normalized =
    [];


  for (
    const month of chosen
  ) {

    const key =

      month === 'Sept'

        ? 'Sep'

        : month === 'June'

          ? 'Jun'

          : month === 'July'

            ? 'Jul'

            : month;


    if (
      budgetMonthMap[key]
      &&
      !normalized.includes(
        key
      )
    ) {

      normalized.push(
        key
      );

    }

  }


  return normalized;

}


function diffClass(
  value
) {

  return Number(
    value
    || 0
  ) < 0

    ? 'budget-negative'

    : 'budget-positive';

}


/* =========================================
   RENDER BUDGET
========================================= */

function renderBudget() {

  const panel =
    el(
      'budgetPanel'
    );


  if (!panel) {

    return;

  }


  if (
    currentView === 'MainGrp'
    ||
    currentView === 'ItemName'
  ) {

    panel.classList.add(
      'budget-hidden'
    );


    return;

  }


  panel.classList.remove(
    'budget-hidden'
  );


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


  if (
    multiSelected
    ||
    !selected.month.length
  ) {

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


  const budgetHead =
    el(
      'budgetTableHead'
    );


  if (budgetHead) {

    budgetHead.innerHTML =
      head;

  }


  const count =
    el(
      'budgetCount'
    );


  if (count) {

    count.textContent =
      fmt(
        budgetRows.length
      );

  }


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
    el(
      'budgetTableBody'
    );


  if (!body) {

    return;

  }


  if (
    !rows.length
  ) {

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

  } else {

    body.innerHTML =

      rows

        .map(
          row => {

            let cells =

              `<td>
                ${esc(
                  row.SalesMan
                  || ''
                )}
              </td>`

              +

              `<td>
                ${esc(
                  row.Party
                  || ''
                )}
              </td>`

              +

              `<td>
                ${esc(
                  row.Target
                  || ''
                )}
              </td>`

              +

              `<td>
                ${esc(
                  row.Order
                  || ''
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


            if (
              multiSelected
              ||
              !selected.month.length
            ) {

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


  const pageInfo =
    el(
      'budgetPageInfo'
    );


  if (pageInfo) {

    pageInfo.textContent =

      `Page ${budgetPage} of ${totalBudgetPages} • ${fmt(
        budgetRows.length
      )} customers`;

  }


  const prev =
    el(
      'budgetPrev'
    );


  if (prev) {

    prev.disabled =
      budgetPage <= 1;

  }


  const next =
    el(
      'budgetNext'
    );


  if (next) {

    next.disabled =
      budgetPage
      >=
      totalBudgetPages;

  }


  const note =
    el(
      'budgetNote'
    );


  if (note) {

    note.textContent =

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

}


/* =========================================
   LOAD BUDGET
========================================= */

async function loadBudget() {

  if (
    currentView === 'MainGrp'
    ||
    currentView === 'ItemName'
  ) {

    renderBudget();

    return;

  }


  const loading =
    el(
      'budgetLoading'
    );


  if (loading) {

    loading.classList.add(
      'show'
    );

  }


  try {

    budgetRows =

      await rpc(
        'raj_customer_budget_report',
        budgetArgs()
      )

      || [];


    renderBudget();


  } catch (error) {

    console.error(
      error
    );


    const body =
      el(
        'budgetTableBody'
      );


    if (body) {

      body.innerHTML = `

        <tr>

          <td class="empty">

            Budget error:
            ${esc(
              error.message
            )}

          </td>

        </tr>

      `;

    }


  } finally {

    if (loading) {

      loading.classList.remove(
        'show'
      );

    }

  }

}


/* =========================================
   MAIN DASHBOARD LOAD
========================================= */

async function loadDashboard(
  reload = false
) {

  const loading =
    el(
      'loading'
    );


  if (loading) {

    loading.classList.add(
      'show'
    );

  }


  try {

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

                el('pageSize')

                  ? el('pageSize').value

                  : 25

              )

          }
        )

      ]);


    const summary =
      summaryResult.summary
      || {};


    if (
      el('totalQty')
    ) {

      el('totalQty').textContent =
        fmt(
          summary.TotalQty
        );

    }


    if (
      el('totalTaxable')
    ) {

      el('totalTaxable').textContent =
        money(
          summary.TotalTaxable
        );

    }


    if (
      el('totalSale')
    ) {

      el('totalSale').textContent =
        money(
          summary.TotalSale
        );

    }


    if (
      el('productsSold')
    ) {

      el('productsSold').textContent =
        fmt(
          summary.ProductsSold
        );

    }


    if (
      el('customersBilled')
    ) {

      el('customersBilled').textContent =
        fmt(
          summary.CustomersBilled
        );

    }


    if (
      el('recordCount')
    ) {

      el('recordCount').textContent =
        fmt(
          rowsResult.totalRows
        );

    }


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


    if (
      el('pageInfo')
    ) {

      el('pageInfo').textContent =

        `Page ${page} of ${totalPages} • ${fmt(
          rowsResult.totalRows
        )} records`;

    }


    if (
      el('prevPage')
    ) {

      el('prevPage').disabled =
        page <= 1;

    }


    if (
      el('nextPage')
    ) {

      el('nextPage').disabled =
        page >= totalPages;

    }


    /*
      Filter options reload થાય છે,
      પણ searchState preserve થાય છે.
    */

    if (
      reload
    ) {

      await refreshFilters();

      buildMonths();

      await loadODOptions();

    }


    await Promise.all([

      loadGroupSummary(),

      loadBudget()

    ]);


  } catch (error) {

    console.error(
      error
    );


    alert(

      'Dashboard error: '

      +

      error.message

    );


  } finally {

    if (loading) {

      loading.classList.remove(
        'show'
      );

    }

  }

}


/* =========================================
   PAGE START
========================================= */

document.addEventListener(
  'DOMContentLoaded',
  async () => {

    try {

      buildFilterUI();


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


      const tableHead =
        el(
          'tableHead'
        );


      if (tableHead) {

        tableHead.innerHTML =

          columns

            .map(
              column =>

                `<th>
                  ${esc(
                    column
                  )}
                </th>`

            )

            .join('');

      }


      buildMonths();


      /*
        CLICK HANDLER
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


          if (
            selectAllButton
          ) {

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


          if (
            unselectAllButton
          ) {

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


          if (
            button
          ) {

            const id =
              button.dataset.open;


            const box =
              el(
                'multi_' + id
              );


            if (!box) {

              return;

            }


            document
              .querySelectorAll(
                '.multi.open'
              )
              .forEach(
                x => {

                  if (
                    x !== box
                  ) {

                    x.classList.remove(
                      'open'
                    );

                  }

                }
              );


            box.classList.toggle(
              'open'
            );


            /*
              ફરી dropdown open કરીએ ત્યારે
              જૂનો typed search visible રહે.
            */

            if (
              box.classList.contains(
                'open'
              )
            ) {

              const search =
                el(
                  'search_' + id
                );


              if (search) {

                search.value =
                  searchState[id]
                  || '';


                applySearchFilter(
                  id
                );


                requestAnimationFrame(
                  () =>
                    search.focus()
                );

              }

            }


            return;

          }


          /*
            CLICK OUTSIDE
          */

          if (
            !event.target.closest(
              '.multi'
            )
          ) {

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
        SEARCH BOXES
      */

      for (
        const [id] of filterDefs
      ) {

        wireSearchBox(
          id
        );

      }


      wireSearchBox(
        'month'
      );


      wireSearchBox(
        'budgetOD'
      );


      /*
        INITIAL LOAD
      */

      await refreshFilters();

      await loadODOptions();

      await loadDashboard();


      /*
        PRODUCT SALE
      */

      if (
        el('productSaleStatus')
      ) {

        el('productSaleStatus').onchange =
          async () => {

            page = 1;


            await loadDashboard(
              true
            );

          };

      }


      /*
        BUDGET STATUS
      */

      if (
        el('budgetStatus')
      ) {

        el('budgetStatus').onchange =
          async () => {

            budgetPage = 1;


            await loadBudget();

          };

      }


      /*
        BUDGET TARGET
      */

      if (
        el('budgetTarget')
      ) {

        el('budgetTarget').onchange =
          async () => {

            budgetPage = 1;


            await loadBudget();

          };

      }


      /*
        GLOBAL SEARCH
      */

      if (
        el('search')
      ) {

        el('search').oninput =
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

      }


      /*
        PAGE SIZE
      */

      if (
        el('pageSize')
      ) {

        el('pageSize').onchange =
          async () => {

            page = 1;


            await loadDashboard();

          };

      }


      /*
        PREVIOUS PAGE
      */

      if (
        el('prevPage')
      ) {

        el('prevPage').onclick =
          async () => {

            if (
              page > 1
            ) {

              page--;


              await loadDashboard();

            }

          };

      }


      /*
        NEXT PAGE
      */

      if (
        el('nextPage')
      ) {

        el('nextPage').onclick =
          async () => {

            if (
              page < totalPages
            ) {

              page++;


              await loadDashboard();

            }

          };

      }


      /*
        BUDGET PREVIOUS
      */

      if (
        el('budgetPrev')
      ) {

        el('budgetPrev').onclick =
          () => {

            if (
              budgetPage > 1
            ) {

              budgetPage--;


              renderBudget();

            }

          };

      }


      /*
        BUDGET NEXT
      */

      if (
        el('budgetNext')
      ) {

        el('budgetNext').onclick =
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


            if (
              budgetPage < pages
            ) {

              budgetPage++;


              renderBudget();

            }

          };

      }


      /*
        CLEAR ALL FILTERS
      */

      if (
        el('clearFilters')
      ) {

        el('clearFilters').onclick =
          async () => {

            if (
              el('search')
            ) {

              el('search').value =
                '';

            }


            selected.month =
              [];


            selected.budgetOD =
              [];


            odParties =
              [];


            /*
              Filter search text પણ clear.
            */

            for (
              const key of Object.keys(
                searchState
              )
            ) {

              searchState[key] =
                '';

            }


            if (
              el('productSaleStatus')
            ) {

              el('productSaleStatus').value =
                'All';

            }


            if (
              el('budgetStatus')
            ) {

              el('budgetStatus').value =
                'all';

            }


            if (
              el('budgetTarget')
            ) {

              el('budgetTarget').value =
                'all';

            }


            filters.forEach(
              column => {

                selected[column] =
                  [];


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

      }


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


                await Promise.all([

                  loadGroupSummary(),

                  loadBudget()

                ]);

              };

          }
        );


    } catch (error) {

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

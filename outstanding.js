(() => {
'use strict';

/* =========================================================
   RAJ OUTSTANDING DASHBOARD
   CLEAN COMPLETE VERSION
========================================================= */

const { createClient } = supabase;

const sb = createClient(
  RAJ_CONFIG.supabaseUrl,
  RAJ_CONFIG.supabasePublishableKey
);

const TOKEN = 'raj_dashboard_session_token';
const DEVICE = 'raj_dashboard_device_id';
const USER = 'raj_dashboard_user';

const RPC_PAGE_SIZE = 1000;
const DETAIL_PAGE_SIZE = 50;

let rows = [];
let uploads = [];
let activeUpload = null;
let charts = {};

let detailPage = 1;

let detailSort = {
  key: 'party',
  dir: 'asc'
};

let historySort = {
  key: 'outstanding_date',
  dir: 'desc'
};

let comparisonRequestId = 0;

const snapshotCache = new Map();

/* =========================================================
   FILTERS
========================================================= */

const filterMap = [
  ['party', 'Customer / Party'],
  ['sm', 'SM'],
  ['grp_name', 'GrpName'],
  ['division', 'Division'],
  ['area', 'Area'],
  ['order_type', 'OD / Order'],
  ['city', 'City'],
  ['pincode', 'Pincode']
];

const filterSelections = {};

filterMap.forEach(([key]) => {
  filterSelections[key] = new Set();
});

/* =========================================================
   AGEING BUCKETS
========================================================= */

const bucketDefs = [
  ['0-15', 'days_15'],
  ['16-30', 'days_30'],
  ['31-45', 'days_45'],
  ['46-60', 'days_60'],
  ['61-75', 'days_75'],
  ['76-90', 'days_90'],
  ['91-120', 'days_120'],
  ['121-150', 'days_150'],
  ['>150', 'over150'],
  ['PDC', 'pdc']
];

const $ = selector =>
  document.querySelector(selector);

function num(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return 0;
  }

  const parsed = Number(
    String(value)
      .replace(/,/g, '')
      .trim()
  );

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function money(value) {
  return '₹ ' +
    Math.round(num(value))
      .toLocaleString('en-IN');
}

function esc(value) {
  return String(value ?? '')
    .replace(
      /[&<>"']/g,
      character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[character])
    );
}

/* =========================================================
   TOAST / ERROR
========================================================= */

function toast(message, stay = false) {
  console.log('[Outstanding]', message);

  const element = $('#toast');

  if (!element) {
    return;
  }

  element.textContent = message;
  element.style.display = 'block';

  clearTimeout(toast.timer);

  if (!stay) {
    toast.timer = setTimeout(() => {
      element.style.display = 'none';
    }, 3500);
  }
}

function showFatal(error) {
  console.error(
    '[Outstanding Dashboard Error]',
    error
  );

  toast(
    'Dashboard error: ' +
      (error?.message || String(error)),
    true
  );
}

/* =========================================================
   AUTH
========================================================= */

function authArgs(extra = {}) {
  return {
    p_session_token:
      localStorage.getItem(TOKEN) || '',

    p_device_id:
      localStorage.getItem(DEVICE) || '',

    ...extra
  };
}

async function rpc(functionName, args = {}) {
  const { data, error } =
    await sb.rpc(
      functionName,
      authArgs(args)
    );

  if (error) {
    throw new Error(
      `${functionName}: ${error.message}`
    );
  }

  return data;
}

async function guard() {
  toast('Checking session...', true);

  if (!localStorage.getItem(TOKEN)) {
    location.href = 'index.html';
    return false;
  }

  const { data, error } =
    await sb.rpc(
      'raj_app_validate_session',
      authArgs()
    );

  if (error) {
    throw new Error(
      'Session check failed: ' +
      error.message
    );
  }

  if (!data || data.success !== true) {
    location.href = 'index.html';
    return false;
  }

  return true;
}

/* =========================================================
   LOAD ALL ROWS - PAGINATION
========================================================= */

async function getAllOutstandingRows(
  uploadId,
  statusPrefix = 'Loading'
) {
  const allRows = [];
  let offset = 0;

  while (true) {

    toast(
      `${statusPrefix} rows... ` +
      `${allRows.length.toLocaleString('en-IN')} loaded`,
      true
    );

    const paged =
      await sb.rpc(
        'raj_outstanding_get_rows',
        authArgs({
          p_upload_id: uploadId,
          p_offset: offset,
          p_limit: RPC_PAGE_SIZE
        })
      );

    if (paged.error) {

      if (offset === 0) {

        const legacy =
          await sb.rpc(
            'raj_outstanding_get_rows',
            authArgs({
              p_upload_id: uploadId
            })
          );

        if (legacy.error) {
          throw new Error(
            'Outstanding rows load failed: ' +
            legacy.error.message
          );
        }

        return Array.isArray(legacy.data)
          ? legacy.data
          : [];
      }

      throw new Error(
        'Outstanding rows load failed: ' +
        paged.error.message
      );
    }

    const page =
      Array.isArray(paged.data)
        ? paged.data
        : [];

    allRows.push(...page);

    if (page.length < RPC_PAGE_SIZE) {
      break;
    }

    offset += RPC_PAGE_SIZE;

    if (offset > 100000) {
      throw new Error(
        'Outstanding pagination safety limit reached.'
      );
    }
  }

  console.log(
    '[Outstanding] Final row count:',
    allRows.length
  );

  return allRows;
}

/* =========================================================
   AGEING CALCULATION

   Source columns are cumulative.

   0-15    = Balance - 15 - PDC
   16-30   = 15 - 30
   31-45   = 30 - 45
   46-60   = 45 - 60
   61-75   = 60 - 75
   76-90   = 75 - 90
   91-120  = 90 - 120
   121-150 = 120 - 150
   >150    = 150
========================================================= */

function bucket(row) {
  return {

    days_15:
      Math.max(
        0,
        num(row.balance) -
        num(row.days_15) -
        num(row.pdc)
      ),

    days_30:
      Math.max(
        0,
        num(row.days_15) -
        num(row.days_30)
      ),

    days_45:
      Math.max(
        0,
        num(row.days_30) -
        num(row.days_45)
      ),

    days_60:
      Math.max(
        0,
        num(row.days_45) -
        num(row.days_60)
      ),

    days_75:
      Math.max(
        0,
        num(row.days_60) -
        num(row.days_75)
      ),

    days_90:
      Math.max(
        0,
        num(row.days_75) -
        num(row.days_90)
      ),

    days_120:
      Math.max(
        0,
        num(row.days_90) -
        num(row.days_120)
      ),

    days_150:
      Math.max(
        0,
        num(row.days_120) -
        num(row.days_150)
      ),

    over150:
      Math.max(
        0,
        num(row.days_150)
      ),

    pdc:
      Math.max(
        0,
        num(row.pdc)
      )
  };
}

/* =========================================================
   FILTER LOGIC
========================================================= */

function rowMatchesSelections(
  row,
  ignoreKey = null
) {
  return filterMap.every(([key]) => {

    if (key === ignoreKey) {
      return true;
    }

    const selected =
      filterSelections[key];

    if (!selected.size) {
      return true;
    }

    const value =
      String(row[key] ?? '').trim();

    return selected.has(value);
  });
}

function filtered(sourceData = rows) {
  return sourceData.filter(
    row => rowMatchesSelections(row)
  );
}

function availableValues(
  key,
  sourceData = rows
) {
  return [
    ...new Set(
      sourceData
        .filter(
          row =>
            rowMatchesSelections(
              row,
              key
            )
        )
        .map(
          row =>
            String(
              row[key] ?? ''
            ).trim()
        )
        .filter(Boolean)
    )
  ].sort(
    (a, b) =>
      a.localeCompare(
        b,
        undefined,
        {
          numeric: true,
          sensitivity: 'base'
        }
      )
  );
}

function pruneSelections() {
  let changed = true;
  let pass = 0;

  while (changed && pass++ < 12) {
    changed = false;

    for (const [key] of filterMap) {

      const available =
        new Set(
          availableValues(key)
        );

      for (
        const value of
        [...filterSelections[key]]
      ) {
        if (!available.has(value)) {
          filterSelections[key]
            .delete(value);

          changed = true;
        }
      }
    }
  }
}

function filterButtonText(
  key,
  label
) {
  const selected =
    filterSelections[key];

  if (!selected.size) {
    return `All ${label}`;
  }

  if (selected.size === 1) {
    return [...selected][0];
  }

  return `${selected.size} selected`;
}

/* =========================================================
   FILTER OPTIONS
========================================================= */

function renderFilterOptions(key) {

  const component =
    document.querySelector(
      `.ms[data-key="${key}"]`
    );

  if (!component) {
    return;
  }

  const definition =
    filterMap.find(
      item => item[0] === key
    );

  if (!definition) {
    return;
  }

  const label =
    definition[1];

  const searchInput =
    component.querySelector(
      '.ms-search'
    );

  const search =
    String(
      searchInput?.value || ''
    )
      .trim()
      .toLowerCase();

  const values =
    availableValues(key)
      .filter(
        value =>
          value
            .toLowerCase()
            .includes(search)
      );

  const options =
    component.querySelector(
      '.ms-options'
    );

  if (!options) {
    return;
  }

  options.innerHTML =
    values.length

      ? values.map(
          value => `
            <label class="ms-option">

              <input
                type="checkbox"
                value="${esc(value)}"
                ${
                  filterSelections[key]
                    .has(value)
                    ? 'checked'
                    : ''
                }
              >

              <span>
                ${esc(value)}
              </span>

            </label>
          `
        ).join('')

      : `
          <div class="ms-empty">
            No matching options
          </div>
        `;

  const trigger =
    component.querySelector(
      '.ms-trigger'
    );

  if (trigger) {
    trigger.textContent =
      filterButtonText(
        key,
        label
      );
  }

  options
    .querySelectorAll(
      'input[type="checkbox"]'
    )
    .forEach(
      checkbox => {

        checkbox.onchange =
          () => {

            if (checkbox.checked) {
              filterSelections[key]
                .add(
                  checkbox.value
                );
            } else {
              filterSelections[key]
                .delete(
                  checkbox.value
                );
            }

            filtersChanged();
          };
      }
    );
}

function refreshAllFilters() {
  filterMap.forEach(
    ([key]) =>
      renderFilterOptions(key)
  );
}

function filtersChanged() {
  pruneSelections();

  detailPage = 1;

  refreshAllFilters();

  render();
}

/* =========================================================
   CREATE FILTERS
========================================================= */

function makeFilters() {

  const container =
    $('#filters');

  if (!container) {
    return;
  }

  container.innerHTML =
    filterMap.map(
      ([key, label]) => `

        <div class="field">

          <label>
            ${esc(label)}
          </label>

          <div
            class="ms"
            data-key="${key}"
          >

            <button
              type="button"
              class="ms-trigger"
            >
              ${esc(
                filterButtonText(
                  key,
                  label
                )
              )}
            </button>

            <div class="ms-menu">

              <div class="ms-search-wrap">

                <input
                  class="ms-search"
                  type="search"
                  placeholder="Search ${esc(label)}..."
                >

              </div>

              <div class="ms-actions">

                <button
                  type="button"
                  data-act="all"
                >
                  Select visible
                </button>

                <button
                  type="button"
                  data-act="clear"
                >
                  Clear
                </button>

              </div>

              <div class="ms-options">
              </div>

            </div>

          </div>

        </div>
      `
    ).join('');

  container
    .querySelectorAll('.ms')
    .forEach(
      component => {

        const key =
          component.dataset.key;

        const trigger =
          component.querySelector(
            '.ms-trigger'
          );

        const menu =
          component.querySelector(
            '.ms-menu'
          );

        const search =
          component.querySelector(
            '.ms-search'
          );

        const selectVisible =
          component.querySelector(
            '[data-act="all"]'
          );

        const clear =
          component.querySelector(
            '[data-act="clear"]'
          );

        trigger.onclick =
          event => {

            event.stopPropagation();

            document
              .querySelectorAll(
                '.ms.open'
              )
              .forEach(
                openComponent => {

                  if (
                    openComponent !==
                    component
                  ) {
                    openComponent
                      .classList
                      .remove('open');
                  }
                }
              );

            component
              .classList
              .toggle('open');

            renderFilterOptions(key);

            if (
              component
                .classList
                .contains('open')
            ) {
              setTimeout(
                () =>
                  search?.focus(),
                20
              );
            }
          };

        menu.onclick =
          event =>
            event.stopPropagation();

        search.oninput =
          () =>
            renderFilterOptions(key);

        clear.onclick =
          () => {

            filterSelections[key]
              .clear();

            search.value = '';

            filtersChanged();
          };

        selectVisible.onclick =
          () => {

            const query =
              String(
                search.value || ''
              )
                .trim()
                .toLowerCase();

            availableValues(key)
              .filter(
                value =>
                  value
                    .toLowerCase()
                    .includes(query)
              )
              .forEach(
                value =>
                  filterSelections[key]
                    .add(value)
              );

            filtersChanged();
          };
      }
    );

  refreshAllFilters();
}

document.addEventListener(
  'click',
  () => {

    document
      .querySelectorAll('.ms.open')
      .forEach(
        component =>
          component
            .classList
            .remove('open')
      );
  }
);

/* =========================================================
   METRICS
========================================================= */

function sum(data, key) {
  return data.reduce(
    (total, row) =>
      total + num(row[key]),
    0
  );
}

function metrics(data) {

  const bucketSums = {};

  bucketDefs.forEach(
    ([, key]) => {

      bucketSums[key] =
        data.reduce(
          (total, row) =>
            total +
            bucket(row)[key],
          0
        );
    }
  );

  return {

    total:
      sum(data, 'balance'),

    customers:
      new Set(
        data
          .map(
            row =>
              String(
                row.party ?? ''
              ).trim()
          )
          .filter(Boolean)
      ).size,

    pdc:
      sum(data, 'pdc'),

    over90:
      sum(data, 'days_90'),

    over150:
      sum(data, 'days_150'),

    bs:
      bucketSums
  };
}



 /* =========================================================
   CHART
========================================================= */

function draw(
  selector,
  type,
  labels,
  datasets,
  options = {}
) {

  if (charts[selector]) {
    charts[selector].destroy();
  }

  const canvas = $(selector);

  if (
    !canvas ||
    typeof Chart === 'undefined'
  ) {
    return;
  }

  charts[selector] =
    new Chart(canvas, {

      type,

      data: {
        labels,
        datasets
      },

      options: {

        responsive: true,
        maintainAspectRatio: false,

        interaction: {
          mode: 'index',
          intersect: false
        },

        plugins: {

          legend: {
            display:
              type === 'doughnut' ||
              !!options.legend
          },

          tooltip: {

            callbacks: {

              label(context) {

                const prefix =
                  context.dataset.label
                    ? context.dataset.label + ': '
                    : '';

                if (options.countChart) {

                  return (
                    prefix +
                    Number(
                      context.raw || 0
                    ).toLocaleString(
                      'en-IN'
                    )
                  );
                }

                return (
                  prefix +
                  money(
                    context.raw || 0
                  )
                );
              }
            }
          }
        },

        scales:
          type === 'doughnut'
            ? {}
            : {

                y: {

                  beginAtZero: true,

                  grid: {
                    color: '#eef1f7'
                  },

                  ticks: {

                    callback(value) {

                      const n =
                        Number(value);

                      if (
                        options.countChart
                      ) {

                        return n.toLocaleString(
                          'en-IN'
                        );
                      }

                      if (
                        Math.abs(n) >=
                        10000000
                      ) {

                        return (
                          n / 10000000
                        ).toFixed(1) + ' Cr';
                      }

                      if (
                        Math.abs(n) >=
                        100000
                      ) {

                        return (
                          n / 100000
                        ).toFixed(1) + ' L';
                      }

                      if (
                        Math.abs(n) >=
                        1000
                      ) {

                        return (
                          n / 1000
                        ).toFixed(0) + ' K';
                      }

                      return n;
                    }
                  }
                },

                x: {
                  grid: {
                    display: false
                  }
                }
              }
      }
    });
}

/* =========================================================
   SIMPLE TABLE
========================================================= */

function simpleTable(
  items,
  columns
) {

  return `
    <table>

      <thead>
        <tr>

          ${
            columns.map(
              column => `
                <th class="${
                  column.num
                    ? 'num'
                    : ''
                }">
                  ${esc(column.label)}
                </th>
              `
            ).join('')
          }

        </tr>
      </thead>

      <tbody>

        ${
          items.length

            ? items.map(
                (row, index) => `

                  <tr>

                    ${
                      columns.map(
                        column => `

                          <td class="${
                            column.num
                              ? 'num'
                              : ''
                          }">

                            ${
                              column.render

                                ? column.render(
                                    row,
                                    index
                                  )

                                : esc(
                                    row[
                                      column.key
                                    ] ?? ''
                                  )
                            }

                          </td>
                        `
                      ).join('')
                    }

                  </tr>
                `
              ).join('')

            : `
                <tr>
                  <td
                    colspan="${columns.length}"
                    class="muted"
                  >
                    No data
                  </td>
                </tr>
              `
        }

      </tbody>

    </table>
  `;
}

/* =========================================================
   SORTING
========================================================= */

const numericFields =
  new Set([
    'balance',
    'days_15',
    'days_30',
    'days_45',
    'days_60',
    'days_75',
    'days_90',
    'days_120',
    'days_150',
    'pdc',
    'total_customers',
    'total_outstanding',
    'total_pdc'
  ]);

function compareValues(
  a,
  b,
  key
) {

  if (
    numericFields.has(key)
  ) {

    return (
      num(a?.[key]) -
      num(b?.[key])
    );
  }

  return String(
    a?.[key] ?? ''
  ).localeCompare(
    String(
      b?.[key] ?? ''
    ),
    undefined,
    {
      numeric: true,
      sensitivity: 'base'
    }
  );
}

function sortArrow(
  sort,
  key
) {

  if (
    sort.key !== key
  ) {
    return '';
  }

  return sort.dir === 'asc'
    ? ' ▲'
    : ' ▼';
}

/* =========================================================
   CUSTOMER DETAILS
========================================================= */

function renderDetails(data) {

  const container =
    $('#customerDetails');

  if (!container) {
    return;
  }

  const search =
    String(
      $('#detailSearch')?.value ||
      ''
    )
      .trim()
      .toLowerCase();

  let list = [...data];

  if (search) {

    list =
      list.filter(
        row => [

          row.party,
          row.sm,
          row.grp_name,
          row.division,
          row.area,
          row.order_type,
          row.city,
          row.pincode

        ].some(
          value =>
            String(
              value ?? ''
            )
              .toLowerCase()
              .includes(search)
        )
      );
  }

  list.sort(
    (a, b) => {

      const result =
        compareValues(
          a,
          b,
          detailSort.key
        );

      return detailSort.dir ===
        'asc'
          ? result
          : -result;
    }
  );

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        list.length /
        DETAIL_PAGE_SIZE
      )
    );

  detailPage =
    Math.min(
      Math.max(
        1,
        detailPage
      ),
      totalPages
    );

  const start =
    (
      detailPage - 1
    ) *
    DETAIL_PAGE_SIZE;

  const pageRows =
    list.slice(
      start,
      start +
      DETAIL_PAGE_SIZE
    );

  const columns = [

    ['party', 'Party', false],

    ['balance', 'Balance', true],

    ['days_15', '>15', true],

    ['days_30', '>30', true],

    ['days_45', '>45', true],

    ['days_60', '>60', true],

    ['days_75', '>75', true],

    ['days_90', '>90', true],

    ['days_120', '>120', true],

    ['days_150', '>150', true],

    ['pdc', 'PDC', true],

    ['sm', 'SM', false],

    ['grp_name', 'GrpName', false],

    ['division', 'Division', false],

    ['area', 'Area', false],

    [
      'order_type',
      'OD / Order',
      false
    ],

    ['city', 'City', false],

    ['pincode', 'Pincode', false]
  ];

  container.innerHTML = `

    <table>

      <thead>

        <tr>

          ${
            columns.map(
              (
                [
                  key,
                  label,
                  numeric
                ]
              ) => `

                <th
                  class="sortable ${
                    numeric
                      ? 'num'
                      : ''
                  }"
                  data-detail-sort="${key}"
                >

                  ${esc(label)}

                  ${
                    sortArrow(
                      detailSort,
                      key
                    )
                  }

                </th>
              `
            ).join('')
          }

        </tr>

      </thead>

      <tbody>

        ${
          pageRows.length

            ? pageRows.map(
                row => `

                  <tr>

                    ${
                      columns.map(
                        (
                          [
                            key,
                            ,
                            numeric
                          ]
                        ) => `

                          <td class="${
                            numeric
                              ? 'num'
                              : ''
                          }">

                            ${
                              numeric

                                ? money(
                                    row[key]
                                  )

                                : esc(
                                    row[key] ??
                                    ''
                                  )
                            }

                          </td>
                        `
                      ).join('')
                    }

                  </tr>
                `
              ).join('')

            : `

                <tr>

                  <td
                    colspan="${columns.length}"
                    class="muted"
                  >
                    No matching data
                  </td>

                </tr>
              `
        }

      </tbody>

    </table>
  `;

  if ($('#detailCount')) {

    $('#detailCount')
      .textContent =
        `${list.length.toLocaleString(
          'en-IN'
        )} rows`;
  }

  if ($('#pageInfo')) {

    $('#pageInfo')
      .textContent =
        `Page ${detailPage} of ${totalPages}`;
  }

  if ($('#prevPage')) {

    $('#prevPage').disabled =
      detailPage <= 1;
  }

  if ($('#nextPage')) {

    $('#nextPage').disabled =
      detailPage >=
      totalPages;
  }

  container
    .querySelectorAll(
      '[data-detail-sort]'
    )
    .forEach(
      heading => {

        heading.onclick =
          () => {

            const key =
              heading.dataset
                .detailSort;

            if (
              detailSort.key ===
              key
            ) {

              detailSort.dir =
                detailSort.dir ===
                'asc'
                  ? 'desc'
                  : 'asc';

            } else {

              detailSort = {
                key,
                dir: 'asc'
              };
            }

            detailPage = 1;

            renderDetails(
              filtered()
            );
          };
      }
    );
}

/* =========================================================
   MAIN DASHBOARD RENDER
========================================================= */

function render() {

  const data =
    filtered();

  const currentMetrics =
    metrics(data);

  /* ---------------- KPI ---------------- */

  const kpis =
    $('#kpis');

  if (kpis) {

    const cards = [

      [
        'Total Outstanding',
        money(
          currentMetrics.total
        )
      ],

      [
        'Total Customers',
        currentMetrics
          .customers
          .toLocaleString(
            'en-IN'
          )
      ],

      [
        'PDC Amount',
        money(
          currentMetrics.pdc
        )
      ],

      [
        'Over 90 Days',
        money(
          currentMetrics.over90
        )
      ],

      [
        'Over 150 Days',
        money(
          currentMetrics.over150
        )
      ]
    ];

    kpis.innerHTML =
      cards.map(
        (
          [
            label,
            value
          ]
        ) => `

          <article class="kpi">

            <span>
              ${esc(label)}
            </span>

            <strong>
              ${esc(value)}
            </strong>

            <small>
              Current snapshot
            </small>

          </article>
        `
      ).join('');
  }

  /* ---------------- AGEING ANALYSIS ---------------- */

  const labels =
    bucketDefs.map(
      item => item[0]
    );

  const values =
    bucketDefs.map(
      item =>
        currentMetrics.bs[
          item[1]
        ]
    );

  draw(
    '#ageChart',
    'bar',
    labels,
    [
      {
        label: 'Amount',
        data: values,
        borderRadius: 6
      }
    ]
  );

  /* ---------------- OUTSTANDING BREAKUP ---------------- */

  draw(
    '#donutChart',
    'doughnut',
    labels,
    [
      {
        label: 'Amount',
        data: values,
        borderWidth: 0
      }
    ],
    {
      legend: true
    }
  );

  /* =====================================================
     AGEING WISE CUSTOMER COUNT (> ₹1,000)

     IMPORTANT:
     Each bar counts UNIQUE customers where that exact
     ageing bucket amount is greater than ₹1,000.
     PDC is not included in this chart.
  ===================================================== */

  const ageingCustomerBuckets = [

    ['0-15', 'days_15'],

    ['16-30', 'days_30'],

    ['31-45', 'days_45'],

    ['46-60', 'days_60'],

    ['61-75', 'days_75'],

    ['76-90', 'days_90'],

    ['91-120', 'days_120'],

    ['121-150', 'days_150'],

    ['>150', 'over150']
  ];

  const ageingCustomerCounts =
    ageingCustomerBuckets.map(
      ([label, key]) => {

        const customers =
          new Set();

        data.forEach(
          row => {

            const ageingAmount =
              bucket(row)[key];

            if (
              ageingAmount > 1000
            ) {

              const party =
                String(
                  row.party ?? ''
                ).trim();

              if (party) {
                customers.add(
                  party
                );
              }
            }
          }
        );

        return customers.size;
      }
    );

  draw(
    '#rangeChart',
    'bar',

    ageingCustomerBuckets.map(
      item => item[0]
    ),

    [
      {
        label:
          'Customers > ₹1,000',

        data:
          ageingCustomerCounts,

        borderRadius: 6
      }
    ],

    {
      countChart: true
    }
  );

  /* ---------------- TOP 5 CUSTOMERS ---------------- */

  const topCustomers =
    [...data]
      .sort(
        (a, b) =>
          num(b.balance) -
          num(a.balance)
      )
      .slice(
        0,
        5
      );

  if ($('#topCustomers')) {

    $('#topCustomers')
      .innerHTML =
        simpleTable(
          topCustomers,
          [

            {
              label: '#',

              render:
                (
                  row,
                  index
                ) =>
                  index + 1
            },

            {
              label:
                'Party Name',

              key:
                'party'
            },

            {
              label:
                'Balance',

              num:
                true,

              render:
                row =>
                  money(
                    row.balance
                  )
            }
          ]
        );
  }

  /* ---------------- TOP 5 >150 ---------------- */

  const overdue =
    [...data]
      .filter(
        row =>
          num(
            row.days_150
          ) > 0
      )
      .sort(
        (a, b) =>
          num(
            b.days_150
          ) -
          num(
            a.days_150
          )
      )
      .slice(
        0,
        5
      );

  if ($('#overdueCustomers')) {

    $('#overdueCustomers')
      .innerHTML =
        simpleTable(
          overdue,
          [

            {
              label: '#',

              render:
                (
                  row,
                  index
                ) =>
                  index + 1
            },

            {
              label:
                'Party Name',

              key:
                'party'
            },

            {
              label:
                '>150 Days',

              num:
                true,

              render:
                row =>
                  money(
                    row.days_150
                  )
            },

            {
              label:
                'Balance',

              num:
                true,

              render:
                row =>
                  money(
                    row.balance
                  )
            }
          ]
        );
  }

  renderDetails(data);

  renderCompare(
    currentMetrics
  );
}

/* =========================================================
   COMPARISON SNAPSHOT SELECTOR
========================================================= */

function populateCompareSelector() {

  const select =
    $('#compareSnapshotSelect');

  if (!select) {
    return;
  }

  const previousValue =
    select.value;

  const available =
    uploads.filter(
      upload =>
        !activeUpload ||
        upload.id !==
          activeUpload.id
    );

  select.innerHTML = `

    <option value="">
      Select snapshot
    </option>

    ${
      available.map(
        upload => `

          <option
            value="${esc(upload.id)}"
          >
            ${esc(
              upload.outstanding_date
            )}
          </option>
        `
      ).join('')
    }
  `;

  if (
    previousValue &&
    available.some(
      upload =>
        upload.id ===
        previousValue
    )
  ) {

    select.value =
      previousValue;

    return;
  }

  const currentIndex =
    uploads.findIndex(
      upload =>
        upload.id ===
        activeUpload?.id
    );

  const previous =
    currentIndex >= 0
      ? uploads[
          currentIndex + 1
        ]
      : null;

  if (previous) {

    select.value =
      previous.id;
  }
}

/* =========================================================
   COMPARISON ROW CACHE
========================================================= */

async function getComparisonRows(
  uploadId
) {

  if (
    snapshotCache.has(
      uploadId
    )
  ) {

    return snapshotCache.get(
      uploadId
    );
  }

  const data =
    await getAllOutstandingRows(
      uploadId,
      'Loading comparison'
    );

  snapshotCache.set(
    uploadId,
    data
  );

  return data;
}

/* =========================================================
   COMPARISON
========================================================= */

async function renderCompare(
  currentMetrics
) {

  const select =
    $('#compareSnapshotSelect');

  if (
    !activeUpload ||
    !select
  ) {
    return;
  }

  const compareId =
    select.value;

  const requestId =
    ++comparisonRequestId;

  if (!compareId) {

    if ($('#summaryCompare')) {

      $('#summaryCompare')
        .innerHTML = `

          <span class="muted">
            Select a snapshot in Compare With.
          </span>
        `;
    }

    draw(
      '#compareChart',
      'bar',
      [],
      []
    );

    return;
  }

  const compareUpload =
    uploads.find(
      upload =>
        upload.id ===
        compareId
    );

  if (!compareUpload) {
    return;
  }

  try {

    const compareRows =
      await getComparisonRows(
        compareId
      );

    if (
      requestId !==
      comparisonRequestId
    ) {
      return;
    }

    /*
      Same selected filters are applied
      to current and comparison snapshots.
    */

    const compareMetrics =
      metrics(
        filtered(
          compareRows
        )
      );

    const compareLabels =
      bucketDefs.map(
        item => item[0]
      );

    draw(
      '#compareChart',
      'bar',
      compareLabels,
      [

        {
          label:
            compareUpload
              .outstanding_date,

          data:
            bucketDefs.map(
              item =>
                compareMetrics.bs[
                  item[1]
                ]
            )
        },

        {
          label:
            activeUpload
              .outstanding_date,

          data:
            bucketDefs.map(
              item =>
                currentMetrics.bs[
                  item[1]
                ]
            )
        }
      ],
      {
        legend: true
      }
    );

    const comparisonTable = [

      {
        metric:
          'Total Outstanding',

        previous:
          compareMetrics.total,

        current:
          currentMetrics.total
      },

      {
        metric:
          'Total Customers',

        previous:
          compareMetrics.customers,

        current:
          currentMetrics.customers,

        count:
          true
      },

      {
        metric:
          'PDC Amount',

        previous:
          compareMetrics.pdc,

        current:
          currentMetrics.pdc
      },

      {
        metric:
          'Over 90 Days',

        previous:
          compareMetrics.over90,

        current:
          currentMetrics.over90
      },

      {
        metric:
          'Over 150 Days',

        previous:
          compareMetrics.over150,

        current:
          currentMetrics.over150
      }
    ];

    if ($('#summaryCompare')) {

      $('#summaryCompare')
        .innerHTML =
          simpleTable(
            comparisonTable,
            [

              {
                label:
                  'Metric',

                key:
                  'metric'
              },

              {
                label:
                  compareUpload
                    .outstanding_date,

                num:
                  true,

                render:
                  row =>
                    row.count

                      ? Number(
                          row.previous
                        ).toLocaleString(
                          'en-IN'
                        )

                      : money(
                          row.previous
                        )
              },

              {
                label:
                  activeUpload
                    .outstanding_date,

                num:
                  true,

                render:
                  row =>
                    row.count

                      ? Number(
                          row.current
                        ).toLocaleString(
                          'en-IN'
                        )

                      : money(
                          row.current
                        )
              }
            ]
          );
    }

  } catch (error) {

    console.error(
      'Comparison error:',
      error
    );

    if (
      requestId !==
      comparisonRequestId
    ) {
      return;
    }

    if ($('#summaryCompare')) {

      $('#summaryCompare')
        .innerHTML = `

          <span class="muted">
            Comparison unavailable:
            ${esc(error.message)}
          </span>
        `;
    }
  }
}



 /* =========================================================
   CHART
========================================================= */

function draw(
  selector,
  type,
  labels,
  datasets,
  options = {}
) {

  if (charts[selector]) {
    charts[selector].destroy();
  }

  const canvas = $(selector);

  if (
    !canvas ||
    typeof Chart === 'undefined'
  ) {
    return;
  }

  charts[selector] =
    new Chart(canvas, {

      type,

      data: {
        labels,
        datasets
      },

      options: {

        responsive: true,
        maintainAspectRatio: false,

        interaction: {
          mode: 'index',
          intersect: false
        },

        plugins: {

          legend: {
            display:
              type === 'doughnut' ||
              !!options.legend
          },

          tooltip: {

            callbacks: {

              label(context) {

                const prefix =
                  context.dataset.label
                    ? context.dataset.label + ': '
                    : '';

                if (options.countChart) {

                  return (
                    prefix +
                    Number(
                      context.raw || 0
                    ).toLocaleString(
                      'en-IN'
                    )
                  );
                }

                return (
                  prefix +
                  money(
                    context.raw || 0
                  )
                );
              }
            }
          }
        },

        scales:
          type === 'doughnut'
            ? {}
            : {

                y: {

                  beginAtZero: true,

                  grid: {
                    color: '#eef1f7'
                  },

                  ticks: {

                    callback(value) {

                      const n =
                        Number(value);

                      if (
                        options.countChart
                      ) {

                        return n.toLocaleString(
                          'en-IN'
                        );
                      }

                      if (
                        Math.abs(n) >=
                        10000000
                      ) {

                        return (
                          n / 10000000
                        ).toFixed(1) + ' Cr';
                      }

                      if (
                        Math.abs(n) >=
                        100000
                      ) {

                        return (
                          n / 100000
                        ).toFixed(1) + ' L';
                      }

                      if (
                        Math.abs(n) >=
                        1000
                      ) {

                        return (
                          n / 1000
                        ).toFixed(0) + ' K';
                      }

                      return n;
                    }
                  }
                },

                x: {
                  grid: {
                    display: false
                  }
                }
              }
      }
    });
}

/* =========================================================
   SIMPLE TABLE
========================================================= */

function simpleTable(
  items,
  columns
) {

  return `
    <table>

      <thead>
        <tr>

          ${
            columns.map(
              column => `
                <th class="${
                  column.num
                    ? 'num'
                    : ''
                }">
                  ${esc(column.label)}
                </th>
              `
            ).join('')
          }

        </tr>
      </thead>

      <tbody>

        ${
          items.length

            ? items.map(
                (row, index) => `

                  <tr>

                    ${
                      columns.map(
                        column => `

                          <td class="${
                            column.num
                              ? 'num'
                              : ''
                          }">

                            ${
                              column.render

                                ? column.render(
                                    row,
                                    index
                                  )

                                : esc(
                                    row[
                                      column.key
                                    ] ?? ''
                                  )
                            }

                          </td>
                        `
                      ).join('')
                    }

                  </tr>
                `
              ).join('')

            : `
                <tr>
                  <td
                    colspan="${columns.length}"
                    class="muted"
                  >
                    No data
                  </td>
                </tr>
              `
        }

      </tbody>

    </table>
  `;
}

/* =========================================================
   SORTING
========================================================= */

const numericFields =
  new Set([
    'balance',
    'days_15',
    'days_30',
    'days_45',
    'days_60',
    'days_75',
    'days_90',
    'days_120',
    'days_150',
    'pdc',
    'total_customers',
    'total_outstanding',
    'total_pdc'
  ]);

function compareValues(
  a,
  b,
  key
) {

  if (
    numericFields.has(key)
  ) {

    return (
      num(a?.[key]) -
      num(b?.[key])
    );
  }

  return String(
    a?.[key] ?? ''
  ).localeCompare(
    String(
      b?.[key] ?? ''
    ),
    undefined,
    {
      numeric: true,
      sensitivity: 'base'
    }
  );
}

function sortArrow(
  sort,
  key
) {

  if (
    sort.key !== key
  ) {
    return '';
  }

  return sort.dir === 'asc'
    ? ' ▲'
    : ' ▼';
}

/* =========================================================
   CUSTOMER DETAILS
========================================================= */

function renderDetails(data) {

  const container =
    $('#customerDetails');

  if (!container) {
    return;
  }

  const search =
    String(
      $('#detailSearch')?.value ||
      ''
    )
      .trim()
      .toLowerCase();

  let list = [...data];

  if (search) {

    list =
      list.filter(
        row => [

          row.party,
          row.sm,
          row.grp_name,
          row.division,
          row.area,
          row.order_type,
          row.city,
          row.pincode

        ].some(
          value =>
            String(
              value ?? ''
            )
              .toLowerCase()
              .includes(search)
        )
      );
  }

  list.sort(
    (a, b) => {

      const result =
        compareValues(
          a,
          b,
          detailSort.key
        );

      return detailSort.dir ===
        'asc'
          ? result
          : -result;
    }
  );

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        list.length /
        DETAIL_PAGE_SIZE
      )
    );

  detailPage =
    Math.min(
      Math.max(
        1,
        detailPage
      ),
      totalPages
    );

  const start =
    (
      detailPage - 1
    ) *
    DETAIL_PAGE_SIZE;

  const pageRows =
    list.slice(
      start,
      start +
      DETAIL_PAGE_SIZE
    );

  const columns = [

    ['party', 'Party', false],

    ['balance', 'Balance', true],

    ['days_15', '>15', true],

    ['days_30', '>30', true],

    ['days_45', '>45', true],

    ['days_60', '>60', true],

    ['days_75', '>75', true],

    ['days_90', '>90', true],

    ['days_120', '>120', true],

    ['days_150', '>150', true],

    ['pdc', 'PDC', true],

    ['sm', 'SM', false],

    ['grp_name', 'GrpName', false],

    ['division', 'Division', false],

    ['area', 'Area', false],

    [
      'order_type',
      'OD / Order',
      false
    ],

    ['city', 'City', false],

    ['pincode', 'Pincode', false]
  ];

  container.innerHTML = `

    <table>

      <thead>

        <tr>

          ${
            columns.map(
              (
                [
                  key,
                  label,
                  numeric
                ]
              ) => `

                <th
                  class="sortable ${
                    numeric
                      ? 'num'
                      : ''
                  }"
                  data-detail-sort="${key}"
                >

                  ${esc(label)}

                  ${
                    sortArrow(
                      detailSort,
                      key
                    )
                  }

                </th>
              `
            ).join('')
          }

        </tr>

      </thead>

      <tbody>

        ${
          pageRows.length

            ? pageRows.map(
                row => `

                  <tr>

                    ${
                      columns.map(
                        (
                          [
                            key,
                            ,
                            numeric
                          ]
                        ) => `

                          <td class="${
                            numeric
                              ? 'num'
                              : ''
                          }">

                            ${
                              numeric

                                ? money(
                                    row[key]
                                  )

                                : esc(
                                    row[key] ??
                                    ''
                                  )
                            }

                          </td>
                        `
                      ).join('')
                    }

                  </tr>
                `
              ).join('')

            : `

                <tr>

                  <td
                    colspan="${columns.length}"
                    class="muted"
                  >
                    No matching data
                  </td>

                </tr>
              `
        }

      </tbody>

    </table>
  `;

  if ($('#detailCount')) {

    $('#detailCount')
      .textContent =
        `${list.length.toLocaleString(
          'en-IN'
        )} rows`;
  }

  if ($('#pageInfo')) {

    $('#pageInfo')
      .textContent =
        `Page ${detailPage} of ${totalPages}`;
  }

  if ($('#prevPage')) {

    $('#prevPage').disabled =
      detailPage <= 1;
  }

  if ($('#nextPage')) {

    $('#nextPage').disabled =
      detailPage >=
      totalPages;
  }

  container
    .querySelectorAll(
      '[data-detail-sort]'
    )
    .forEach(
      heading => {

        heading.onclick =
          () => {

            const key =
              heading.dataset
                .detailSort;

            if (
              detailSort.key ===
              key
            ) {

              detailSort.dir =
                detailSort.dir ===
                'asc'
                  ? 'desc'
                  : 'asc';

            } else {

              detailSort = {
                key,
                dir: 'asc'
              };
            }

            detailPage = 1;

            renderDetails(
              filtered()
            );
          };
      }
    );
}

/* =========================================================
   MAIN DASHBOARD RENDER
========================================================= */

function render() {

  const data =
    filtered();

  const currentMetrics =
    metrics(data);

  /* ---------------- KPI ---------------- */

  const kpis =
    $('#kpis');

  if (kpis) {

    const cards = [

      [
        'Total Outstanding',
        money(
          currentMetrics.total
        )
      ],

      [
        'Total Customers',
        currentMetrics
          .customers
          .toLocaleString(
            'en-IN'
          )
      ],

      [
        'PDC Amount',
        money(
          currentMetrics.pdc
        )
      ],

      [
        'Over 90 Days',
        money(
          currentMetrics.over90
        )
      ],

      [
        'Over 150 Days',
        money(
          currentMetrics.over150
        )
      ]
    ];

    kpis.innerHTML =
      cards.map(
        (
          [
            label,
            value
          ]
        ) => `

          <article class="kpi">

            <span>
              ${esc(label)}
            </span>

            <strong>
              ${esc(value)}
            </strong>

            <small>
              Current snapshot
            </small>

          </article>
        `
      ).join('');
  }

  /* ---------------- AGEING ANALYSIS ---------------- */

  const labels =
    bucketDefs.map(
      item => item[0]
    );

  const values =
    bucketDefs.map(
      item =>
        currentMetrics.bs[
          item[1]
        ]
    );

  draw(
    '#ageChart',
    'bar',
    labels,
    [
      {
        label: 'Amount',
        data: values,
        borderRadius: 6
      }
    ]
  );

  /* ---------------- OUTSTANDING BREAKUP ---------------- */

  draw(
    '#donutChart',
    'doughnut',
    labels,
    [
      {
        label: 'Amount',
        data: values,
        borderWidth: 0
      }
    ],
    {
      legend: true
    }
  );

  /* =====================================================
     AGEING WISE CUSTOMER COUNT (> ₹1,000)

     IMPORTANT:
     Each bar counts UNIQUE customers where that exact
     ageing bucket amount is greater than ₹1,000.
     PDC is not included in this chart.
  ===================================================== */

  const ageingCustomerBuckets = [

    ['0-15', 'days_15'],

    ['16-30', 'days_30'],

    ['31-45', 'days_45'],

    ['46-60', 'days_60'],

    ['61-75', 'days_75'],

    ['76-90', 'days_90'],

    ['91-120', 'days_120'],

    ['121-150', 'days_150'],

    ['>150', 'over150']
  ];

  const ageingCustomerCounts =
    ageingCustomerBuckets.map(
      ([label, key]) => {

        const customers =
          new Set();

        data.forEach(
          row => {

            const ageingAmount =
              bucket(row)[key];

            if (
              ageingAmount > 1000
            ) {

              const party =
                String(
                  row.party ?? ''
                ).trim();

              if (party) {
                customers.add(
                  party
                );
              }
            }
          }
        );

        return customers.size;
      }
    );

  draw(
    '#rangeChart',
    'bar',

    ageingCustomerBuckets.map(
      item => item[0]
    ),

    [
      {
        label:
          'Customers > ₹1,000',

        data:
          ageingCustomerCounts,

        borderRadius: 6
      }
    ],

    {
      countChart: true
    }
  );

  /* ---------------- TOP 5 CUSTOMERS ---------------- */

  const topCustomers =
    [...data]
      .sort(
        (a, b) =>
          num(b.balance) -
          num(a.balance)
      )
      .slice(
        0,
        5
      );

  if ($('#topCustomers')) {

    $('#topCustomers')
      .innerHTML =
        simpleTable(
          topCustomers,
          [

            {
              label: '#',

              render:
                (
                  row,
                  index
                ) =>
                  index + 1
            },

            {
              label:
                'Party Name',

              key:
                'party'
            },

            {
              label:
                'Balance',

              num:
                true,

              render:
                row =>
                  money(
                    row.balance
                  )
            }
          ]
        );
  }

  /* ---------------- TOP 5 >150 ---------------- */

  const overdue =
    [...data]
      .filter(
        row =>
          num(
            row.days_150
          ) > 0
      )
      .sort(
        (a, b) =>
          num(
            b.days_150
          ) -
          num(
            a.days_150
          )
      )
      .slice(
        0,
        5
      );

  if ($('#overdueCustomers')) {

    $('#overdueCustomers')
      .innerHTML =
        simpleTable(
          overdue,
          [

            {
              label: '#',

              render:
                (
                  row,
                  index
                ) =>
                  index + 1
            },

            {
              label:
                'Party Name',

              key:
                'party'
            },

            {
              label:
                '>150 Days',

              num:
                true,

              render:
                row =>
                  money(
                    row.days_150
                  )
            },

            {
              label:
                'Balance',

              num:
                true,

              render:
                row =>
                  money(
                    row.balance
                  )
            }
          ]
        );
  }

  renderDetails(data);

  renderCompare(
    currentMetrics
  );
}

/* =========================================================
   COMPARISON SNAPSHOT SELECTOR
========================================================= */

function populateCompareSelector() {

  const select =
    $('#compareSnapshotSelect');

  if (!select) {
    return;
  }

  const previousValue =
    select.value;

  const available =
    uploads.filter(
      upload =>
        !activeUpload ||
        upload.id !==
          activeUpload.id
    );

  select.innerHTML = `

    <option value="">
      Select snapshot
    </option>

    ${
      available.map(
        upload => `

          <option
            value="${esc(upload.id)}"
          >
            ${esc(
              upload.outstanding_date
            )}
          </option>
        `
      ).join('')
    }
  `;

  if (
    previousValue &&
    available.some(
      upload =>
        upload.id ===
        previousValue
    )
  ) {

    select.value =
      previousValue;

    return;
  }

  const currentIndex =
    uploads.findIndex(
      upload =>
        upload.id ===
        activeUpload?.id
    );

  const previous =
    currentIndex >= 0
      ? uploads[
          currentIndex + 1
        ]
      : null;

  if (previous) {

    select.value =
      previous.id;
  }
}

/* =========================================================
   COMPARISON ROW CACHE
========================================================= */

async function getComparisonRows(
  uploadId
) {

  if (
    snapshotCache.has(
      uploadId
    )
  ) {

    return snapshotCache.get(
      uploadId
    );
  }

  const data =
    await getAllOutstandingRows(
      uploadId,
      'Loading comparison'
    );

  snapshotCache.set(
    uploadId,
    data
  );

  return data;
}

/* =========================================================
   COMPARISON
========================================================= */

async function renderCompare(
  currentMetrics
) {

  const select =
    $('#compareSnapshotSelect');

  if (
    !activeUpload ||
    !select
  ) {
    return;
  }

  const compareId =
    select.value;

  const requestId =
    ++comparisonRequestId;

  if (!compareId) {

    if ($('#summaryCompare')) {

      $('#summaryCompare')
        .innerHTML = `

          <span class="muted">
            Select a snapshot in Compare With.
          </span>
        `;
    }

    draw(
      '#compareChart',
      'bar',
      [],
      []
    );

    return;
  }

  const compareUpload =
    uploads.find(
      upload =>
        upload.id ===
        compareId
    );

  if (!compareUpload) {
    return;
  }

  try {

    const compareRows =
      await getComparisonRows(
        compareId
      );

    if (
      requestId !==
      comparisonRequestId
    ) {
      return;
    }

    /*
      Same selected filters are applied
      to current and comparison snapshots.
    */

    const compareMetrics =
      metrics(
        filtered(
          compareRows
        )
      );

    const compareLabels =
      bucketDefs.map(
        item => item[0]
      );

    draw(
      '#compareChart',
      'bar',
      compareLabels,
      [

        {
          label:
            compareUpload
              .outstanding_date,

          data:
            bucketDefs.map(
              item =>
                compareMetrics.bs[
                  item[1]
                ]
            )
        },

        {
          label:
            activeUpload
              .outstanding_date,

          data:
            bucketDefs.map(
              item =>
                currentMetrics.bs[
                  item[1]
                ]
            )
        }
      ],
      {
        legend: true
      }
    );

    const comparisonTable = [

      {
        metric:
          'Total Outstanding',

        previous:
          compareMetrics.total,

        current:
          currentMetrics.total
      },

      {
        metric:
          'Total Customers',

        previous:
          compareMetrics.customers,

        current:
          currentMetrics.customers,

        count:
          true
      },

      {
        metric:
          'PDC Amount',

        previous:
          compareMetrics.pdc,

        current:
          currentMetrics.pdc
      },

      {
        metric:
          'Over 90 Days',

        previous:
          compareMetrics.over90,

        current:
          currentMetrics.over90
      },

      {
        metric:
          'Over 150 Days',

        previous:
          compareMetrics.over150,

        current:
          currentMetrics.over150
      }
    ];

    if ($('#summaryCompare')) {

      $('#summaryCompare')
        .innerHTML =
          simpleTable(
            comparisonTable,
            [

              {
                label:
                  'Metric',

                key:
                  'metric'
              },

              {
                label:
                  compareUpload
                    .outstanding_date,

                num:
                  true,

                render:
                  row =>
                    row.count

                      ? Number(
                          row.previous
                        ).toLocaleString(
                          'en-IN'
                        )

                      : money(
                          row.previous
                        )
              },

              {
                label:
                  activeUpload
                    .outstanding_date,

                num:
                  true,

                render:
                  row =>
                    row.count

                      ? Number(
                          row.current
                        ).toLocaleString(
                          'en-IN'
                        )

                      : money(
                          row.current
                        )
              }
            ]
          );
    }

  } catch (error) {

    console.error(
      'Comparison error:',
      error
    );

    if (
      requestId !==
      comparisonRequestId
    ) {
      return;
    }

    if ($('#summaryCompare')) {

      $('#summaryCompare')
        .innerHTML = `

          <span class="muted">
            Comparison unavailable:
            ${esc(error.message)}
          </span>
        `;
    }
  }
}

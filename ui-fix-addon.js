/* ============================================================
   RAJ AGENCIES
   UI FIX + MULTI ACTUAL MONTH
   VERSION: online25

   FEATURES
   ------------------------------------------------------------
   1. All multi dropdowns stay above other panels
   2. Dropdown opens UP automatically if space below is low
   3. Dropdown opens DOWN when enough space exists
   4. Fixes City / Division / Pincode / SM / Party / OD /
      Month / Compare Months dropdown clipping
   5. Actual Month converted to searchable multi-select
   6. Actual Month gets Select All / Unselect All
   7. Compare Avg vs Actual Avg
   8. Only TWO summary RPC calls for comparison
      - one for Compare Months
      - one for Actual Months
   ============================================================ */

(() => {

  'use strict';


  /* =========================================================
     STATE
     ========================================================= */

  let rajUiInitialized = false;

  let rajActualMonths = [];

  let rajActualSearch = '';

  let rajComparisonTimer = null;

  let rajComparisonRequestId = 0;


  /* =========================================================
     HELPERS
     ========================================================= */

  const rajUiEl = id =>
    document.getElementById(id);


  function rajUiEscape(value){

    const div =
      document.createElement('div');

    div.textContent =
      String(value ?? '');

    return div.innerHTML;

  }


  function rajUiMoney(value){

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


  function rajUiNumber(value){

    return new Intl.NumberFormat(
      'en-IN',
      {
        maximumFractionDigits:2
      }
    ).format(
      Number(value || 0)
    );

  }


  function rajMonthName(month){

    try{

      return (
        monthNames?.[month]
        ||
        month
      );

    }catch(_){

      return month;

    }

  }


  function rajAvailableMonths(){

    try{

      return Array.isArray(months)
        ? [...months]
        : [];

    }catch(_){

      return [];

    }

  }


  /* =========================================================
     CSS
     ========================================================= */

  function rajAddUiFixStyles(){

    if(
      rajUiEl('rajUiFixStyles')
    ){
      return;
    }


    const style =
      document.createElement('style');


    style.id =
      'rajUiFixStyles';


    style.textContent = `

      /* =====================================================
         ALLOW DROPDOWNS OUTSIDE PANELS
         ===================================================== */

      .panel,
      .filters,
      .search-grid,
      .budget-filters,
      .compare-controls,
      #filterGrid{
        overflow:visible !important;
      }


      .panel{
        position:relative;
      }


      /*
        Normal panel stack.
        Open dropdown panel receives higher z-index dynamically.
      */

      .raj-panel-dropdown-active{
        z-index:9000 !important;
      }


      /* =====================================================
         MULTI SELECT
         ===================================================== */

      .multi{
        position:relative !important;
      }


      .multi.open{
        z-index:99999 !important;
      }


      .multi .multi-menu{

        position:absolute !important;

        left:0 !important;
        right:0 !important;

        top:calc(100% + 7px) !important;
        bottom:auto !important;

        z-index:100000 !important;

        max-height:min(420px,55vh) !important;

        overflow:hidden !important;

        border:
          1px solid
          rgba(111,91,245,.24) !important;

        border-radius:16px !important;

        background:
          rgba(255,255,255,.98) !important;

        box-shadow:
          0 20px 55px
          rgba(44,35,100,.22) !important;

        backdrop-filter:
          blur(18px);

        -webkit-backdrop-filter:
          blur(18px);

      }


      /*
        Automatically open upward when there isn't enough
        viewport space below the control.
      */

      .multi.raj-open-up .multi-menu{

        top:auto !important;

        bottom:calc(100% + 7px) !important;

      }


      .multi-options{

        max-height:330px !important;

        overflow-y:auto !important;

        overflow-x:hidden !important;

        overscroll-behavior:contain;

      }


      .multi-search{

        position:relative;

        z-index:2;

        background:#fff !important;

      }


      /* =====================================================
         ACTUAL MONTH CUSTOM MULTI
         ===================================================== */

      #rajActualMonthField{

        width:100%;

      }


      #multi_actualMonths{

        width:100%;

      }


      #rajActualMonthChips{

        display:flex;

        flex-wrap:wrap;

        gap:6px;

        margin-top:8px;

      }


      #rajActualMonthChips .chip{

        display:inline-flex;

        align-items:center;

        padding:
          5px
          9px;

        border-radius:999px;

        background:
          #ede9fe;

        color:
          #5b4bd8;

        font-size:10px;

        font-weight:800;

      }


      /*
        Old native Actual Month select is hidden,
        but remains in DOM for compatibility.
      */

      #actualCompareMonth{

        display:none !important;

      }


      /* =====================================================
         MOBILE
         ===================================================== */

      @media(max-width:760px){

        .multi .multi-menu{

          max-height:
            min(390px,60vh) !important;

        }


        .multi-options{

          max-height:
            285px !important;

        }

      }

    `;


    document.head.appendChild(
      style
    );

  }


  /* =========================================================
     PANEL Z-INDEX
     ========================================================= */

  function rajClearPanelLayers(){

    document
      .querySelectorAll(
        '.raj-panel-dropdown-active'
      )
      .forEach(
        panel => {

          panel.classList.remove(
            'raj-panel-dropdown-active'
          );

        }
      );

  }


  function rajRaiseContainingPanel(multi){

    rajClearPanelLayers();


    const panel =
      multi?.closest(
        '.panel'
      );


    if(panel){

      panel.classList.add(
        'raj-panel-dropdown-active'
      );

    }

  }


  /* =========================================================
     OPEN UP / DOWN POSITION
     ========================================================= */

  function rajPositionMulti(multi){

    if(
      !multi
      ||
      !multi.classList.contains('open')
    ){
      return;
    }


    const button =
      multi.querySelector(
        '.multi-btn'
      );


    const menu =
      multi.querySelector(
        '.multi-menu'
      );


    if(
      !button
      ||
      !menu
    ){
      return;
    }


    const rect =
      button.getBoundingClientRect();


    const viewportHeight =
      window.innerHeight
      ||
      document.documentElement.clientHeight;


    const spaceBelow =
      viewportHeight
      -
      rect.bottom;


    const spaceAbove =
      rect.top;


    /*
      Typical dropdown useful height.
    */

    const desiredHeight =
      Math.min(
        400,
        Math.max(
          250,
          menu.scrollHeight || 320
        )
      );


    const shouldOpenUp =
      (
        spaceBelow < desiredHeight
        &&
        spaceAbove > spaceBelow
      );


    multi.classList.toggle(
      'raj-open-up',
      shouldOpenUp
    );


    rajRaiseContainingPanel(
      multi
    );

  }


  function rajPositionAllOpenMultis(){

    document
      .querySelectorAll(
        '.multi.open'
      )
      .forEach(
        multi => {

          rajPositionMulti(
            multi
          );

        }
      );

  }


  /* =========================================================
     MONITOR EXISTING MULTI BUTTONS
     ========================================================= */

  function rajWireExistingMultiButtons(){

    document
      .querySelectorAll(
        '.multi-btn'
      )
      .forEach(
        button => {

          if(
            button.dataset.rajUiWired === '1'
          ){
            return;
          }


          button.dataset.rajUiWired =
            '1';


          button.addEventListener(
            'click',
            () => {

              const multi =
                button.closest(
                  '.multi'
                );


              /*
                Main script toggles .open in its own click handler.
                We wait for that change then decide direction.
              */

              setTimeout(
                () => {

                  if(
                    multi
                    &&
                    multi.classList.contains(
                      'open'
                    )
                  ){

                    rajPositionMulti(
                      multi
                    );

                  }else{

                    multi
                      ?.classList
                      .remove(
                        'raj-open-up'
                      );


                    rajClearPanelLayers();

                  }

                },
                0
              );

            }
          );

        }
      );

  }


  /* =========================================================
     ACTUAL MONTH FIELD
     ========================================================= */

  function rajCreateActualMonthMulti(){

    const nativeSelect =
      rajUiEl(
        'actualCompareMonth'
      );


    if(!nativeSelect){

      return false;
    }


    if(
      rajUiEl(
        'rajActualMonthField'
      )
    ){

      return true;
    }


    const field =
      nativeSelect.closest(
        '.field'
      );


    if(!field){

      return false;
    }


    /*
      Keep original select for backwards compatibility,
      but create our custom UI after it.
    */

    const wrapper =
      document.createElement(
        'div'
      );


    wrapper.id =
      'rajActualMonthField';


    wrapper.innerHTML = `

      <div
        class="multi"
        id="multi_actualMonths"
      >

        <button
          type="button"
          class="multi-btn"
          id="rajActualMonthButton"
        >

          <span id="label_actualMonths">
            Select Actual Months
          </span>

          <span>
            ▾
          </span>

        </button>


        <div class="multi-menu">

          <input
            class="multi-search"
            id="search_actualMonths"
            placeholder="Search month..."
          >


          <div
            class="multi-options"
            id="options_actualMonths"
          ></div>

        </div>

      </div>


      <div
        id="rajActualMonthChips"
        class="selected-chips"
      ></div>

    `;


    nativeSelect.insertAdjacentElement(
      'afterend',
      wrapper
    );


    const button =
      rajUiEl(
        'rajActualMonthButton'
      );


    button
      ?.addEventListener(
        'click',
        event => {

          event.stopPropagation();


          const multi =
            rajUiEl(
              'multi_actualMonths'
            );


          if(!multi){
            return;
          }


          /*
            Close all other dropdowns.
          */

          document
            .querySelectorAll(
              '.multi.open'
            )
            .forEach(
              other => {

                if(
                  other !== multi
                ){

                  other.classList.remove(
                    'open'
                  );

                  other.classList.remove(
                    'raj-open-up'
                  );

                }

              }
            );


          multi.classList.toggle(
            'open'
          );


          if(
            multi.classList.contains(
              'open'
            )
          ){

            rajPositionMulti(
              multi
            );


            setTimeout(
              () => {

                rajUiEl(
                  'search_actualMonths'
                )
                  ?.focus();

              },
              20
            );

          }else{

            multi.classList.remove(
              'raj-open-up'
            );


            rajClearPanelLayers();

          }

        }
      );


    const search =
      rajUiEl(
        'search_actualMonths'
      );


    search
      ?.addEventListener(
        'input',
        () => {

          rajActualSearch =
            search.value
            || '';


          rajFilterActualOptions();

        }
      );


    document.addEventListener(
      'click',
      event => {

        const multi =
          rajUiEl(
            'multi_actualMonths'
          );


        if(
          multi
          &&
          !multi.contains(
            event.target
          )
        ){

          multi.classList.remove(
            'open'
          );


          multi.classList.remove(
            'raj-open-up'
          );

        }

      }
    );


    rajBuildActualOptions();


    return true;

  }


  /* =========================================================
     ACTUAL MONTH LABEL
     ========================================================= */

  function rajUpdateActualLabel(){

    const label =
      rajUiEl(
        'label_actualMonths'
      );


    const chips =
      rajUiEl(
        'rajActualMonthChips'
      );


    if(label){

      label.textContent =

        rajActualMonths.length

          ? `${rajActualMonths.length} selected`

          : 'Select Actual Months';

    }


    if(chips){

      chips.innerHTML =

        rajActualMonths
          .map(
            month => `

              <span class="chip">
                ${rajUiEscape(
                  rajMonthName(month)
                )}
              </span>

            `
          )
          .join('');

    }


    /*
      Keep old select compatible:
      when exactly one actual month is selected,
      old select contains that month.
      Multiple selection -> old select blank.
    */

    const nativeSelect =
      rajUiEl(
        'actualCompareMonth'
      );


    if(nativeSelect){

      nativeSelect.value =

        rajActualMonths.length === 1

          ? rajActualMonths[0]

          : '';

    }

  }


  /* =========================================================
     ACTUAL MONTH OPTIONS
     ========================================================= */

  function rajBuildActualOptions(){

    const box =
      rajUiEl(
        'options_actualMonths'
      );


    if(!box){
      return;
    }


    const available =
      rajAvailableMonths();


    /*
      Remove stale selections if schema months change.
    */

    rajActualMonths =
      rajActualMonths.filter(
        month =>
          available.includes(
            month
          )
      );


    box.innerHTML = `

      <div style="
        display:flex;
        gap:8px;
        padding:8px 6px 10px;
        border-bottom:1px solid #e5e7eb;
        position:sticky;
        top:0;
        background:#fff;
        z-index:5;
      ">

        <button
          type="button"
          id="rajActualSelectAll"
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
          id="rajActualUnselectAll"
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


      ${

        available
          .map(
            month => `

              <label
                class="multi-option"
                data-text="${rajUiEscape(
                  String(
                    rajMonthName(month)
                  )
                    .toLowerCase()
                )}"
              >

                <input
                  type="checkbox"
                  value="${rajUiEscape(month)}"
                  ${
                    rajActualMonths.includes(
                      month
                    )
                      ? 'checked'
                      : ''
                  }
                >

                <span>
                  ${rajUiEscape(
                    rajMonthName(month)
                  )}
                </span>

              </label>

            `
          )
          .join('')

      }

    `;


    rajUiEl(
      'rajActualSelectAll'
    )
      ?.addEventListener(
        'click',
        async event => {

          event.stopPropagation();


          const visibleMonths =

            [
              ...box.querySelectorAll(
                '.multi-option'
              )
            ]
              .filter(
                option =>
                  option.style.display
                  !== 'none'
              )
              .map(
                option =>
                  option.querySelector(
                    'input'
                  )
                  ?.value
              )
              .filter(Boolean);


          rajActualMonths =
            [
              ...new Set(
                [
                  ...rajActualMonths,
                  ...visibleMonths
                ]
              )
            ];


          rajBuildActualOptions();

          rajUpdateActualLabel();

          rajRestoreActualOpen();

          await rajLoadComparisonMulti();

        }
      );


    rajUiEl(
      'rajActualUnselectAll'
    )
      ?.addEventListener(
        'click',
        async event => {

          event.stopPropagation();


          const visibleMonths =

            [
              ...box.querySelectorAll(
                '.multi-option'
              )
            ]
              .filter(
                option =>
                  option.style.display
                  !== 'none'
              )
              .map(
                option =>
                  option.querySelector(
                    'input'
                  )
                  ?.value
              )
              .filter(Boolean);


          const visibleSet =
            new Set(
              visibleMonths
            );


          rajActualMonths =
            rajActualMonths.filter(
              month =>
                !visibleSet.has(
                  month
                )
            );


          rajBuildActualOptions();

          rajUpdateActualLabel();

          rajRestoreActualOpen();

          await rajLoadComparisonMulti();

        }
      );


    box
      .querySelectorAll(
        'input[type="checkbox"]'
      )
      .forEach(
        checkbox => {

          checkbox.addEventListener(
            'change',
            async () => {

              if(
                checkbox.checked
              ){

                if(
                  !rajActualMonths.includes(
                    checkbox.value
                  )
                ){

                  rajActualMonths.push(
                    checkbox.value
                  );

                }

              }else{

                rajActualMonths =
                  rajActualMonths.filter(
                    month =>
                      month !==
                      checkbox.value
                  );

              }


              rajUpdateActualLabel();


              await rajLoadComparisonMulti();


              rajRestoreActualOpen();

            }
          );

        }
      );


    rajFilterActualOptions();

    rajUpdateActualLabel();

  }


  function rajFilterActualOptions(){

    const text =
      String(
        rajActualSearch || ''
      )
        .toLowerCase()
        .trim();


    document
      .querySelectorAll(
        '#options_actualMonths .multi-option'
      )
      .forEach(
        option => {

          const value =
            String(
              option.dataset.text
              ||
              ''
            );


          option.style.display =

            value.includes(
              text
            )

              ? 'flex'

              : 'none';

        }
      );

  }


  function rajRestoreActualOpen(){

    const multi =
      rajUiEl(
        'multi_actualMonths'
      );


    if(!multi){
      return;
    }


    multi.classList.add(
      'open'
    );


    rajPositionMulti(
      multi
    );


    const search =
      rajUiEl(
        'search_actualMonths'
      );


    if(search){

      search.value =
        rajActualSearch;


      requestAnimationFrame(
        () => {

          search.focus();


          const length =
            search.value.length;


          try{

            search.setSelectionRange(
              length,
              length
            );

          }catch(_){}

        }
      );

    }

  }


  /* =========================================================
     CHANGE CARD LABELS
     ========================================================= */

  function rajUpdateComparisonCardTitles(){

    const actualMonthCard =
      rajUiEl(
        'compareActualMonth'
      )
        ?.closest(
          '.compare-card'
        );


    const actualSaleCard =
      rajUiEl(
        'compareActualSale'
      )
        ?.closest(
          '.compare-card'
        );


    if(actualMonthCard){

      const span =
        actualMonthCard.querySelector(
          'span'
        );


      if(span){

        span.textContent =
          'Actual Months';

      }

    }


    if(actualSaleCard){

      const span =
        actualSaleCard.querySelector(
          'span'
        );


      if(span){

        span.textContent =
          'Actual Avg Taxable Sale';

      }

    }

  }


  /* =========================================================
     SET COMPARISON TEXT
     ========================================================= */

  function rajSetComparisonText(
    id,
    value
  ){

    const node =
      rajUiEl(id);


    if(node){

      node.textContent =
        value;

    }

  }


  /* =========================================================
     FAST MULTI ACTUAL COMPARISON
     ========================================================= */

  async function rajLoadComparisonMulti(){

    const requestId =
      ++rajComparisonRequestId;


    let compareMonths = [];


    try{

      compareMonths =
        Array.isArray(
          selected.compareMonths
        )
          ? [
              ...selected.compareMonths
            ]
          : [];

    }catch(_){

      compareMonths = [];

    }


    const actualMonths =
      [...rajActualMonths];


    const status =
      rajUiEl(
        'compareStatus'
      );


    /*
      Display chosen month names.
    */

    rajSetComparisonText(
      'compareMonthsText',

      compareMonths.length

        ? compareMonths
            .map(
              rajMonthName
            )
            .join(' + ')

        : 'Select months'
    );


    rajSetComparisonText(
      'compareActualMonth',

      actualMonths.length

        ? actualMonths
            .map(
              rajMonthName
            )
            .join(' + ')

        : '-'
    );


    if(
      !compareMonths.length
      ||
      !actualMonths.length
    ){

      rajSetComparisonText(
        'compareAvgSale',
        rajUiMoney(0)
      );


      rajSetComparisonText(
        'compareActualSale',
        rajUiMoney(0)
      );


      rajSetComparisonText(
        'compareDifference',
        rajUiMoney(0)
      );


      rajSetComparisonText(
        'comparePercent',
        '0%'
      );


      if(status){

        status.textContent =
          'Select months';


        status.className =
          'compare-neutral';

      }


      return;

    }


    try{

      if(
        typeof comparisonBaseArgs
        !== 'function'
      ){

        throw new Error(
          'Comparison filters are not ready.'
        );

      }


      if(
        typeof rpc
        !== 'function'
      ){

        throw new Error(
          'Dashboard RPC is not ready.'
        );

      }


      const baseArgs =
        comparisonBaseArgs();


      /*
        PERFORMANCE:

        Compare Months:
        ONE summary query with all selected months.

        Actual Months:
        ONE summary query with all selected months.

        TotalTaxable returned for multiple months is the
        selected-period total. Divide by selected month count
        to get monthly average.
      */

      const [
        compareResult,
        actualResult
      ] =
        await Promise.all(
          [

            rpc(
              'raj_dashboard_summary',
              {
                ...baseArgs,
                p_months:
                  compareMonths
              }
            ),


            rpc(
              'raj_dashboard_summary',
              {
                ...baseArgs,
                p_months:
                  actualMonths
              }
            )

          ]
        );


      /*
        Ignore old result if user changed months while
        the requests were running.
      */

      if(
        requestId !==
        rajComparisonRequestId
      ){

        return;

      }


      const compareTotal =
        Number(
          compareResult
            ?.summary
            ?.TotalTaxable

          ||
          0
        );


      const actualTotal =
        Number(
          actualResult
            ?.summary
            ?.TotalTaxable

          ||
          0
        );


      const compareAvg =

        compareMonths.length

          ? compareTotal
            /
            compareMonths.length

          : 0;


      const actualAvg =

        actualMonths.length

          ? actualTotal
            /
            actualMonths.length

          : 0;


      const difference =
        actualAvg
        -
        compareAvg;


      const percentage =

        compareAvg !== 0

          ? (
              difference
              /
              compareAvg
            )
            *
            100

          : 0;


      rajSetComparisonText(
        'compareAvgSale',
        rajUiMoney(
          compareAvg
        )
      );


      rajSetComparisonText(
        'compareActualSale',
        rajUiMoney(
          actualAvg
        )
      );


      rajSetComparisonText(
        'compareDifference',

        (
          difference > 0
            ? '+'
            : ''
        )

        +

        rajUiMoney(
          difference
        )
      );


      rajSetComparisonText(
        'comparePercent',

        (
          percentage > 0
            ? '+'
            : ''
        )

        +

        rajUiNumber(
          percentage
        )

        +

        '%'
      );


      if(status){

        if(
          difference > 0
        ){

          status.textContent =
            'Above Avg';


          status.className =
            'compare-positive';


        }else if(
          difference < 0
        ){

          status.textContent =
            'Below Avg';


          status.className =
            'compare-negative';


        }else{

          status.textContent =
            'Equal to Avg';


          status.className =
            'compare-neutral';

        }

      }


    }catch(error){

      console.error(
        'Multi Actual Comparison error:',
        error
      );


      if(status){

        status.textContent =
          'Comparison error';


        status.className =
          'compare-negative';

      }

    }

  }


  /* =========================================================
     DEBOUNCED COMPARISON
     ========================================================= */

  function rajQueueComparison(){

    clearTimeout(
      rajComparisonTimer
    );


    rajComparisonTimer =
      setTimeout(
        () => {

          rajLoadComparisonMulti();

        },
        120
      );

  }


  /* =========================================================
     OVERRIDE ORIGINAL COMPARISON
     ========================================================= */

  function rajInstallComparisonOverride(){

    if(
      typeof loadComparison
      !== 'function'
    ){

      return false;
    }


    loadComparison =
      async function(){

        return await
          rajLoadComparisonMulti();

      };


    return true;

  }


  /* =========================================================
     KEEP COMPARE MONTH UI CONNECTED
     ========================================================= */

  function rajWireCompareMonthChanges(){

    const box =
      rajUiEl(
        'options_compareMonths'
      );


    if(!box){
      return;
    }


    /*
      Main script already changes selected.compareMonths.
      This listener simply ensures our new multi comparison
      is recalculated afterwards.
    */

    if(
      box.dataset.rajActualCompareWired
      === '1'
    ){

      return;

    }


    box.dataset.rajActualCompareWired =
      '1';


    box.addEventListener(
      'change',
      () => {

        rajQueueComparison();

      }
    );

  }


  /* =========================================================
     CLOSE / REPOSITION
     ========================================================= */

  window.addEventListener(
    'resize',
    () => {

      rajPositionAllOpenMultis();

    }
  );


  window.addEventListener(
    'scroll',
    () => {

      rajPositionAllOpenMultis();

    },
    true
  );


  document.addEventListener(
    'click',
    () => {

      setTimeout(
        () => {

          const open =
            document.querySelector(
              '.multi.open'
            );


          if(!open){

            rajClearPanelLayers();

          }

        },
        0
      );

    }
  );


  /* =========================================================
     PERIODIC SAFE UI SYNC
     ========================================================= */

  function rajUiSafeSync(){

    rajWireExistingMultiButtons();

    rajCreateActualMonthMulti();

    rajWireCompareMonthChanges();

    rajUpdateComparisonCardTitles();


    /*
      If main script rebuilt comparison month controls,
      rebuild Actual month list from the same schema months.
    */

    const available =
      rajAvailableMonths();


    const existingCheckboxes =
      document.querySelectorAll(
        '#options_actualMonths input[type="checkbox"]'
      );


    if(
      available.length
      &&
      existingCheckboxes.length
      !== available.length
    ){

      rajBuildActualOptions();

    }

  }


  /* =========================================================
     INITIALIZE
     ========================================================= */

  function rajInitializeUiFix(){

    if(
      rajUiInitialized
    ){
      return;
    }


    rajUiInitialized =
      true;


    rajAddUiFixStyles();


    /*
      Install comparison override once main script exists.
    */

    let attempts =
      0;


    const installTimer =
      setInterval(
        () => {

          attempts++;


          const comparisonReady =
            rajInstallComparisonOverride();


          rajUiSafeSync();


          if(
            comparisonReady
            &&
            rajUiEl(
              'rajActualMonthField'
            )
          ){

            clearInterval(
              installTimer
            );

          }


          if(
            attempts >= 120
          ){

            clearInterval(
              installTimer
            );

          }

        },
        100
      );


    /*
      Main dashboard rebuilds some option lists.
      Light periodic sync keeps positioning / handlers intact.
    */

    setInterval(
      rajUiSafeSync,
      1200
    );

  }


  if(
    document.readyState
    === 'loading'
  ){

    document.addEventListener(
      'DOMContentLoaded',
      rajInitializeUiFix,
      {
        once:true
      }
    );

  }else{

    rajInitializeUiFix();

  }


})();

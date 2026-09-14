/* ============================================================
   RAJ AGENCIES
   HARD LINKED CUSTOMER FILTER
   VERSION: online27

   CUSTOMER / PARTY NOW FOLLOWS:
   - Main Group
   - Item Group
   - Item Code
   - Item Name
   - SM
   - Division
   - City
   - Pincode
   - Month
   - Product Sale Status
   - Global Search
   - Budget Target
   - Budget Status
   - OD / Order

   IMPORTANT:
   Only Customer / Party options are refreshed.
   Other dropdowns remain fast.
   ============================================================ */

(() => {

  'use strict';


  /* =========================================================
     STATE
     ========================================================= */

  let linkedTimer = null;

  let linkedBusy = false;

  let linkedPending = false;

  let linkedLastSignature = '';

  let linkedRequestNo = 0;


  /* =========================================================
     HELPERS
     ========================================================= */

  const linkedEl = id =>
    document.getElementById(id);


  function linkedEsc(value){

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


  function linkedArray(value){

    if(!Array.isArray(value)){
      return [];
    }


    return [

      ...new Set(

        value
          .map(
            item =>
              String(
                item ?? ''
              ).trim()
          )
          .filter(Boolean)

      )

    ];

  }


  function linkedSelected(
    key
  ){

    try{

      return linkedArray(
        selected[key]
      );

    }catch(_){

      return [];

    }

  }


  /* =========================================================
     CHECK BUDGET / TARGET SCOPE
     ========================================================= */

  function linkedBudgetTarget(){

    return (
      linkedEl(
        'budgetTarget'
      )
        ?.value
      ||
      'all'
    );

  }


  function linkedBudgetStatus(){

    return (
      linkedEl(
        'budgetStatus'
      )
        ?.value
      ||
      'all'
    );

  }


  function linkedProductStatus(){

    return (
      linkedEl(
        'productSaleStatus'
      )
        ?.value
      ||
      'All'
    );

  }


  function linkedSearch(){

    return (
      linkedEl(
        'search'
      )
        ?.value
        ?.trim()
      ||
      ''
    );

  }


  function linkedBudgetScopeActive(){

    return (

      linkedSelected(
        'budgetOD'
      ).length > 0

      ||

      linkedBudgetTarget()
      !== 'all'

      ||

      linkedBudgetStatus()
      !== 'all'

    );

  }


  /* =========================================================
     SIGNATURE

     Party itself intentionally excluded.
     ========================================================= */

  function linkedSignature(){

    const value = {

      MainGrp:
        linkedSelected(
          'MainGrp'
        ).sort(),

      ItemGroup:
        linkedSelected(
          'ItemGroup'
        ).sort(),

      ItemCode:
        linkedSelected(
          'ItemCode'
        ).sort(),

      ItemName:
        linkedSelected(
          'ItemName'
        ).sort(),

      SM:
        linkedSelected(
          'SM'
        ).sort(),

      Division:
        linkedSelected(
          'Division'
        ).sort(),

      City:
        linkedSelected(
          'City'
        ).sort(),

      Pincode:
        linkedSelected(
          'Pincode'
        ).sort(),

      month:
        linkedSelected(
          'month'
        ).sort(),

      budgetOD:
        linkedSelected(
          'budgetOD'
        ).sort(),

      target:
        linkedBudgetTarget(),

      budgetStatus:
        linkedBudgetStatus(),

      productStatus:
        linkedProductStatus(),

      search:
        linkedSearch()

    };


    return JSON.stringify(
      value
    );

  }


  /* =========================================================
     NORMAL PRODUCT FILTER OBJECT
     PARTY EXCLUDED
     ========================================================= */

  function linkedProductFilters(){

    const obj = {};


    const keys = [

      'MainGrp',
      'ItemGroup',
      'ItemCode',
      'ItemName',
      'SM',
      'Division',
      'City',
      'Pincode'

    ];


    keys.forEach(
      key => {

        const values =
          linkedSelected(
            key
          );


        if(
          values.length
        ){

          obj[key] =
            values;

        }

      }
    );


    return obj;

  }


  /* =========================================================
     GET TARGET / OD / BUDGET CUSTOMER PARTY SCOPE
     ========================================================= */

  async function linkedGetBudgetPartyScope(){

    if(
      !linkedBudgetScopeActive()
    ){

      return null;

    }


    if(
      typeof rpc
      !== 'function'
    ){

      return [];

    }


    const result =
      await rpc(
        'raj_budget_sales_scope_parties',
        {

          p_sms:
            linkedSelected('SM').length

              ? linkedSelected('SM')

              : null,


          p_cities:
            linkedSelected('City').length

              ? linkedSelected('City')

              : null,


          p_pincodes:
            linkedSelected('Pincode').length

              ? linkedSelected('Pincode')

              : null,


          p_divisions:
            linkedSelected('Division').length

              ? linkedSelected('Division')

              : null,


          /*
            Party must be null here.

            We are trying to DISCOVER which customers
            should be available.
          */

          p_parties:
            null,


          p_ods:
            linkedSelected('budgetOD').length

              ? linkedSelected('budgetOD')

              : null,


          p_target_mode:
            linkedBudgetTarget(),


          p_status:
            linkedBudgetStatus(),


          p_months:
            linkedSelected('month').length

              ? linkedSelected('month')

              : null

        }
      );


    return linkedArray(
      Array.isArray(result)
        ? result
        : []
    );

  }


  /* =========================================================
     FETCH FINAL CUSTOMER VALUES
     ========================================================= */

  async function linkedFetchCustomers(){

    if(
      typeof rpc
      !== 'function'
    ){

      return [];

    }


    const filters =
      linkedProductFilters();


    /*
      If Target / OD / Budget Status active,
      first obtain exact permitted Party scope.
    */

    const budgetParties =
      await linkedGetBudgetPartyScope();


    if(
      budgetParties !== null
    ){

      /*
        Scope active but no customers match.
      */

      if(
        budgetParties.length === 0
      ){

        return [];

      }


      filters.Party =
        budgetParties;

    }


    /*
      Now ask products table for Party values
      matching every selected normal filter.
    */

    const data =
      await rpc(
        'raj_filter_values',
        {

          p_column:
            'Party',

          p_filters:
            filters,

          p_months:
            linkedSelected(
              'month'
            ),

          p_sale_status:
            linkedProductStatus(),

          p_search:
            linkedSearch()

        }
      );


    const values =
      (
        Array.isArray(data)
          ? data
          : []
      )
        .map(
          row => {

            if(
              row
              &&
              typeof row
                === 'object'
            ){

              return (

                row.value

                ??

                row.Value

                ??

                Object.values(
                  row
                )[0]

              );

            }


            return row;

          }
        );


    return linkedArray(
      values
    );

  }


  /* =========================================================
     UPDATE CUSTOMER LABEL
     ========================================================= */

  function linkedUpdateLabel(){

    try{

      if(
        typeof updateMultiLabel
        === 'function'
      ){

        updateMultiLabel(
          'Party'
        );

        return;

      }

    }catch(_){}


    const label =
      linkedEl(
        'label_Party'
      );


    if(label){

      const values =
        linkedSelected(
          'Party'
        );


      label.textContent =

        values.length

          ? `${values.length} selected`

          : 'All Customers';

    }

  }


  /* =========================================================
     SEARCH CUSTOMER OPTIONS
     ========================================================= */

  function linkedApplyPartySearch(){

    const search =
      linkedEl(
        'search_Party'
      );


    if(!search){
      return;
    }


    let value = '';


    try{

      value =
        searchState.Party
        ??
        search.value
        ??
        '';

    }catch(_){

      value =
        search.value
        ||
        '';

    }


    search.value =
      value;


    const text =
      String(value)
        .toLowerCase()
        .trim();


    document
      .querySelectorAll(
        '#options_Party .multi-option'
      )
      .forEach(
        option => {

          const optionText =
            String(
              option.dataset.text
              ||
              ''
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


  /* =========================================================
     PARTY SELECT ALL / UNSELECT ALL
     ========================================================= */

  function linkedVisiblePartyValues(){

    return [

      ...document
        .querySelectorAll(
          '#options_Party .multi-option'
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
            'input[type="checkbox"]'
          )
            ?.value
      )
      .filter(Boolean);

  }


  async function linkedApplyPartyBulk(
    selectAll
  ){

    if(
      selectAll
    ){

      selected.Party =
        linkedVisiblePartyValues();

    }else{

      selected.Party =
        [];

    }


    linkedUpdateLabel();


    try{

      page =
        1;

      budgetPage =
        1;

    }catch(_){}


    if(
      typeof loadDashboard
      === 'function'
    ){

      await loadDashboard(
        false
      );

    }


    linkedOpenParty();

  }


  /* =========================================================
     RENDER CUSTOMER OPTIONS
     ========================================================= */

  function linkedRenderCustomers(
    values
  ){

    const box =
      linkedEl(
        'options_Party'
      );


    if(!box){
      return;
    }


    const validSet =
      new Set(
        values.map(
          String
        )
      );


    /*
      Remove selected customer if it no longer belongs
      to current filter combination.
    */

    selected.Party =
      linkedSelected(
        'Party'
      )
        .filter(
          party =>
            validSet.has(
              String(party)
            )
        );


    linkedUpdateLabel();


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
          id="rajLinkedPartySelectAll"
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
          id="rajLinkedPartyUnselectAll"
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
        values.length

          ? values
              .map(
                value => `

                  <label
                    class="multi-option"
                    data-text="${linkedEsc(
                      String(value)
                        .toLowerCase()
                    )}"
                  >

                    <input
                      type="checkbox"
                      value="${linkedEsc(value)}"
                      ${
                        selected.Party.includes(
                          String(value)
                        )
                          ? 'checked'
                          : ''
                      }
                    >

                    <span>
                      ${linkedEsc(value)}
                    </span>

                  </label>

                `
              )
              .join('')

          : `

              <div style="
                padding:18px 10px;
                text-align:center;
                color:#64748b;
                font-size:12px;
                font-weight:700;
              ">
                No customers match selected filters.
              </div>

            `
      }

    `;


    linkedEl(
      'rajLinkedPartySelectAll'
    )
      ?.addEventListener(
        'click',
        async event => {

          event.preventDefault();

          event.stopPropagation();


          await linkedApplyPartyBulk(
            true
          );

        }
      );


    linkedEl(
      'rajLinkedPartyUnselectAll'
    )
      ?.addEventListener(
        'click',
        async event => {

          event.preventDefault();

          event.stopPropagation();


          await linkedApplyPartyBulk(
            false
          );

        }
      );


    box
      .querySelectorAll(
        '.multi-option input[type="checkbox"]'
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
                  !selected.Party.includes(
                    checkbox.value
                  )
                ){

                  selected.Party.push(
                    checkbox.value
                  );

                }

              }else{

                selected.Party =
                  selected.Party.filter(
                    value =>
                      value !==
                      checkbox.value
                  );

              }


              linkedUpdateLabel();


              try{

                page =
                  1;

                budgetPage =
                  1;

              }catch(_){}


              if(
                typeof loadDashboard
                === 'function'
              ){

                await loadDashboard(
                  false
                );

              }


              linkedOpenParty();

            }
          );

        }
      );


    linkedApplyPartySearch();

  }


  /* =========================================================
     OPEN CUSTOMER MENU
     ========================================================= */

  function linkedOpenParty(){

    const multi =
      linkedEl(
        'multi_Party'
      );


    if(!multi){
      return;
    }


    multi.classList.add(
      'open'
    );


    try{

      if(
        typeof rajPositionMulti
        === 'function'
      ){

        rajPositionMulti(
          multi
        );

      }

    }catch(_){}

  }


  /* =========================================================
     RUN CUSTOMER REFRESH
     ========================================================= */

  async function linkedRefresh(
    force = false
  ){

    const signature =
      linkedSignature();


    if(
      !force
      &&
      signature ===
      linkedLastSignature
    ){

      return;

    }


    if(
      linkedBusy
    ){

      linkedPending =
        true;

      return;

    }


    linkedBusy =
      true;


    const requestNo =
      ++linkedRequestNo;


    try{

      const values =
        await linkedFetchCustomers();


      if(
        requestNo !==
        linkedRequestNo
      ){

        return;

      }


      linkedRenderCustomers(
        values
      );


      linkedLastSignature =
        signature;


    }catch(error){

      console.error(
        'Linked Customer error:',
        error
      );


    }finally{

      linkedBusy =
        false;


      if(
        linkedPending
      ){

        linkedPending =
          false;


        setTimeout(
          () => {

            linkedRefresh(
              true
            );

          },
          50
        );

      }

    }

  }


  /* =========================================================
     DEBOUNCED REFRESH
     ========================================================= */

  function linkedQueueRefresh(
    delay = 250
  ){

    clearTimeout(
      linkedTimer
    );


    linkedTimer =
      setTimeout(
        () => {

          linkedRefresh(
            false
          );

        },
        delay
      );

  }


  /* =========================================================
     CAPTURE FILTER CHANGES DIRECTLY

     This does not depend only on loadDashboard.
     ========================================================= */

  function linkedInstallGlobalListeners(){

    document.addEventListener(
      'change',
      event => {

        const target =
          event.target;


        if(!target){
          return;
        }


        /*
          Ignore Customer's own checkbox.
        */

        if(
          target.closest(
            '#options_Party'
          )
        ){

          return;

        }


        /*
          Main filters.
        */

        if(
          target.closest(
            '#filterGrid'
          )
        ){

          linkedQueueRefresh(
            300
          );

          return;

        }


        /*
          Month.
        */

        if(
          target.closest(
            '#options_month'
          )
        ){

          linkedQueueRefresh(
            300
          );

          return;

        }


        /*
          OD Team.
        */

        if(
          target.closest(
            '#options_budgetOD'
          )
        ){

          linkedQueueRefresh(
            300
          );

          return;

        }


        /*
          Native selectors.
        */

        if(
          target.id
          === 'budgetTarget'

          ||

          target.id
          === 'budgetStatus'

          ||

          target.id
          === 'productSaleStatus'
        ){

          linkedQueueRefresh(
            300
          );

        }

      },
      true
    );


    /*
      Bulk select buttons use click,
      not checkbox change.
    */

    document.addEventListener(
      'click',
      event => {

        const button =
          event.target.closest(
            '[data-select-all], [data-unselect-all]'
          );


        if(!button){
          return;
        }


        const id =

          button.dataset.selectAll

          ??

          button.dataset.unselectAll;


        if(
          id
          &&
          id !== 'Party'
          &&
          id !== 'compareMonths'
          &&
          id !== 'actualMonths'
        ){

          linkedQueueRefresh(
            450
          );

        }

      },
      true
    );

  }


  /* =========================================================
     GLOBAL SEARCH
     ========================================================= */

  function linkedInstallSearchListener(){

    const search =
      linkedEl(
        'search'
      );


    if(!search){
      return;
    }


    search.addEventListener(
      'input',
      () => {

        linkedQueueRefresh(
          600
        );

      }
    );

  }


  /* =========================================================
     CUSTOMER SEARCH
     ========================================================= */

  function linkedInstallPartySearch(){

    const search =
      linkedEl(
        'search_Party'
      );


    if(!search){
      return;
    }


    search.addEventListener(
      'input',
      () => {

        try{

          searchState.Party =
            search.value;

        }catch(_){}


        linkedApplyPartySearch();

      }
    );

  }


  /* =========================================================
     CUSTOMER DROPDOWN OPEN

     Force refresh before user sees list.
     ========================================================= */

  function linkedInstallPartyOpen(){

    document.addEventListener(
      'click',
      event => {

        const button =
          event.target.closest(
            '[data-open="Party"]'
          );


        if(!button){
          return;
        }


        /*
          Immediate server sync when opening Customer.
        */

        linkedRefresh(
          true
        );

      },
      true
    );

  }


  /* =========================================================
     WRAP DASHBOARD

     Extra safety after dashboard data finishes loading.
     ========================================================= */

  function linkedWrapDashboard(){

    if(
      typeof loadDashboard
      !== 'function'
    ){

      return false;

    }


    if(
      loadDashboard.__rajLinkedOnline27
    ){

      return true;

    }


    const oldLoadDashboard =
      loadDashboard;


    const wrapped =
      async function(
        ...args
      ){

        const result =
          await oldLoadDashboard
            .apply(
              this,
              args
            );


        linkedQueueRefresh(
          100
        );


        return result;

      };


    wrapped.__rajLinkedOnline27 =
      true;


    loadDashboard =
      wrapped;


    return true;

  }


  /* =========================================================
     INITIALIZE
     ========================================================= */

  function linkedInit(){

    linkedInstallGlobalListeners();

    linkedInstallSearchListener();

    linkedInstallPartyOpen();


    let attempts =
      0;


    const timer =
      setInterval(
        () => {

          attempts++;


          linkedInstallPartySearch();

          const ready =
            linkedWrapDashboard();


          if(
            ready
            &&
            typeof selected
              !== 'undefined'
            &&
            linkedEl(
              'options_Party'
            )
          ){

            clearInterval(
              timer
            );


            setTimeout(
              () => {

                linkedRefresh(
                  true
                );

              },
              700
            );

          }


          if(
            attempts >= 150
          ){

            clearInterval(
              timer
            );

          }

        },
        100
      );

  }


  if(
    document.readyState
    === 'loading'
  ){

    document.addEventListener(
      'DOMContentLoaded',
      linkedInit,
      {
        once:true
      }
    );

  }else{

    linkedInit();

  }

})();

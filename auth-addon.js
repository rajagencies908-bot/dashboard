/* ============================================================
   RAJ AGENCIES
   AUTH + ROLE ACCESS ADDON
   Version: online21

   FIXED:
   - Mobile + Password Login
   - Session Validation
   - Device Lock
   - Logout
   - SM Role Access
   - OD Role Access
   - SalesHead Access
   - Admin Full Access
   - SM user can select SUBSET of allowed SM codes
   - Example DH/RM -> DH only / RM only / both
   - Unauthorized SM codes hidden
   - Unauthorized OD codes hidden
   - Analysis View respects selected allowed SM
   - NO rawBudgetArgs reassignment
   - NO const reassignment error
   - Fail Closed Dashboard
   ============================================================ */

(() => {

  'use strict';


  /* =========================================================
     STORAGE KEYS
     ========================================================= */

  const AUTH_DEVICE_KEY =
    'raj_dashboard_device_id';

  const AUTH_SESSION_KEY =
    'raj_dashboard_session_token';

  const AUTH_USER_KEY =
    'raj_dashboard_user';


  /* =========================================================
     STATE
     ========================================================= */

  let rajAuthUser = null;

  let rajAuthStarted = false;

  let rajAuthRefreshing = false;

  let dashboardProtected = false;

  let analysisProtected = false;


  /* =========================================================
     HELPERS
     ========================================================= */

  const authEl = id =>
    document.getElementById(id);


  function escapeHtml(value){

    const div =
      document.createElement('div');

    div.textContent =
      String(value ?? '');

    return div.innerHTML;

  }


  function normalizeCodes(value){

    if(!Array.isArray(value)){
      return [];
    }


    return value
      .map(
        item =>
          String(
            item ?? ''
          ).trim()
      )
      .filter(Boolean);

  }


  function uniqueCodes(values){

    return [
      ...new Set(
        normalizeCodes(values)
      )
    ];

  }


  /* =========================================================
     DASHBOARD LOCK
     ========================================================= */

  function lockDashboard(){

    document.documentElement
      .classList
      .add(
        'raj-auth-pending'
      );


    document.body
      ?.classList
      .add(
        'raj-auth-locked'
      );

  }


  function unlockDashboard(){

    document.documentElement
      .classList
      .remove(
        'raj-auth-pending'
      );


    document.body
      ?.classList
      .remove(
        'raj-auth-locked'
      );

  }


  /* =========================================================
     DEVICE
     ========================================================= */

  function getDeviceId(){

    let deviceId =
      localStorage.getItem(
        AUTH_DEVICE_KEY
      );


    if(deviceId){

      return deviceId;

    }


    if(
      window.crypto
      &&
      typeof window.crypto.randomUUID
        === 'function'
    ){

      deviceId =
        window.crypto.randomUUID();

    }else{

      deviceId =
        'raj-' +
        Date.now() +
        '-' +
        Math.random()
          .toString(36)
          .slice(2) +
        '-' +
        Math.random()
          .toString(36)
          .slice(2);

    }


    localStorage.setItem(
      AUTH_DEVICE_KEY,
      deviceId
    );


    return deviceId;

  }


  /* =========================================================
     SESSION
     ========================================================= */

  function getSessionToken(){

    return (
      localStorage.getItem(
        AUTH_SESSION_KEY
      )
      ||
      ''
    );

  }


  function saveSession(
    token,
    user
  ){

    localStorage.setItem(
      AUTH_SESSION_KEY,
      token
    );


    localStorage.setItem(
      AUTH_USER_KEY,
      JSON.stringify(
        user || {}
      )
    );

  }


  function clearSession(){

    localStorage.removeItem(
      AUTH_SESSION_KEY
    );


    localStorage.removeItem(
      AUTH_USER_KEY
    );


    rajAuthUser =
      null;

  }


  /* =========================================================
     AUTH CSS
     ========================================================= */

  function addAuthStyles(){

    if(
      authEl(
        'rajAuthStyles'
      )
    ){

      return;

    }


    const style =
      document.createElement(
        'style'
      );


    style.id =
      'rajAuthStyles';


    style.textContent = `

      body.raj-auth-locked{
        overflow:hidden !important;
      }


      body.raj-auth-locked > .topbar,
      body.raj-auth-locked > .container{
        visibility:hidden !important;
      }


      #rajAuthScreen{

        position:fixed;
        inset:0;

        z-index:999999;

        display:flex;

        align-items:center;
        justify-content:center;

        padding:24px;

        font-family:
          Inter,
          system-ui,
          -apple-system,
          "Segoe UI",
          sans-serif;

        background:

          radial-gradient(
            circle at 15% 10%,
            rgba(95,75,245,.35),
            transparent 30%
          ),

          radial-gradient(
            circle at 88% 15%,
            rgba(236,72,153,.22),
            transparent 27%
          ),

          radial-gradient(
            circle at 80% 90%,
            rgba(6,182,212,.22),
            transparent 30%
          ),

          linear-gradient(
            135deg,
            #edf3ff 0%,
            #f6f2ff 45%,
            #eefaff 100%
          );

      }


      .raj-auth-box{

        width:min(
          440px,
          100%
        );

        position:relative;

        overflow:hidden;

        box-sizing:border-box;

        padding:
          38px
          34px
          34px;

        border:
          1px solid
          rgba(
            255,
            255,
            255,
            .90
          );

        border-radius:
          28px;

        background:
          rgba(
            255,
            255,
            255,
            .84
          );

        backdrop-filter:
          blur(28px);

        -webkit-backdrop-filter:
          blur(28px);

        box-shadow:
          0 30px 80px
          rgba(
            54,
            45,
            120,
            .20
          );

      }


      .raj-auth-logo{

        width:62px;
        height:62px;

        margin:
          0
          auto
          16px;

        display:grid;
        place-items:center;

        border-radius:19px;

        color:#fff;

        font-size:29px;
        font-weight:900;

        background:
          linear-gradient(
            135deg,
            #4f46e5,
            #7c3aed,
            #b052ef
          );

        box-shadow:
          0 13px 28px
          rgba(
            99,
            76,
            230,
            .30
          );

      }


      .raj-auth-title{

        margin:0;

        text-align:center;

        color:#17213c;

        font-size:26px;

        font-weight:900;

        letter-spacing:-.7px;

      }


      .raj-auth-subtitle{

        margin:
          7px
          0
          28px;

        text-align:center;

        color:#777f91;

        font-size:12px;

      }


      .raj-auth-field{

        margin-bottom:
          15px;

      }


      .raj-auth-field label{

        display:block;

        margin-bottom:
          7px;

        color:#505970;

        font-size:11px;

        font-weight:850;

      }


      .raj-auth-field input{

        width:100%;
        height:49px;

        box-sizing:border-box;

        padding:
          0
          14px;

        border:
          1px solid
          rgba(
            95,
            82,
            170,
            .18
          );

        border-radius:
          13px;

        outline:none;

        background:
          rgba(
            255,
            255,
            255,
            .90
          );

        color:#17213c;

        font-size:14px;

      }


      .raj-auth-field input:focus{

        border-color:
          rgba(
            95,
            75,
            235,
            .62
          );

        box-shadow:
          0 0 0 4px
          rgba(
            95,
            75,
            235,
            .10
          );

      }


      #rajLoginButton{

        width:100%;
        height:50px;

        margin-top:5px;

        border:0;

        border-radius:14px;

        cursor:pointer;

        color:#fff;

        font-size:14px;

        font-weight:900;

        background:
          linear-gradient(
            135deg,
            #5548ed,
            #8b58f0
          );

        box-shadow:
          0 12px 25px
          rgba(
            89,
            70,
            225,
            .25
          );

      }


      #rajLoginButton:disabled{

        opacity:.60;

        cursor:not-allowed;

      }


      #rajLoginMessage{

        min-height:21px;

        margin-top:15px;

        text-align:center;

        font-size:12px;

        font-weight:750;

      }


      .raj-auth-error{

        color:#c8324e;

      }


      .raj-auth-success{

        color:#08794d;

      }


      .raj-auth-footer{

        margin-top:17px;

        padding-top:15px;

        border-top:
          1px solid
          rgba(
            100,
            90,
            160,
            .10
          );

        color:#979cab;

        text-align:center;

        font-size:10px;

      }


      #rajUserArea{

        display:flex;

        align-items:center;

        gap:10px;

        margin-left:10px;

      }


      .raj-user-card{

        display:flex;

        align-items:center;

        gap:9px;

        padding:
          6px
          8px
          6px
          7px;

        border:
          1px solid
          rgba(
            100,
            90,
            180,
            .10
          );

        border-radius:
          999px;

        background:
          rgba(
            255,
            255,
            255,
            .72
          );

      }


      .raj-user-avatar{

        width:31px;
        height:31px;

        display:grid;

        place-items:center;

        border-radius:50%;

        color:#fff;

        font-size:12px;

        font-weight:900;

        background:
          linear-gradient(
            135deg,
            #6252ef,
            #995bea
          );

      }


      .raj-user-text{

        min-width:
          80px;

      }


      .raj-user-name{

        color:#1d2743;

        font-size:11px;

        font-weight:900;

        line-height:1.15;

      }


      .raj-user-role{

        margin-top:2px;

        color:#81889a;

        font-size:9px;

        font-weight:700;

      }


      #rajLogoutBtn{

        border:0;

        padding:
          8px
          11px;

        border-radius:
          999px;

        cursor:pointer;

        color:#b5223c;

        background:#fff0f3;

        font-size:10px;

        font-weight:900;

      }


      #rajAccessBadge{

        margin:
          0
          0
          18px;

        padding:
          10px
          14px;

        border-radius:13px;

        border:
          1px solid
          rgba(
            100,
            82,
            225,
            .10
          );

        background:
          linear-gradient(
            90deg,
            rgba(
              239,
              237,
              255,
              .84
            ),
            rgba(
              249,
              245,
              255,
              .75
            )
          );

        color:#5648c7;

        font-size:11px;

        font-weight:800;

      }


      .raj-role-restricted-note{

        display:block;

        margin-top:5px;

        color:#6d28d9;

        font-size:9px;

        font-weight:800;

      }


      @media(max-width:760px){

        .raj-auth-box{

          padding:
            30px
            22px
            25px;

        }


        .raj-auth-title{

          font-size:23px;

        }


        .raj-user-text{

          display:none;

        }

      }

    `;


    document.head.appendChild(
      style
    );

  }


  /* =========================================================
     LOGIN SCREEN
     ========================================================= */

  function createLoginScreen(){

    let screen =
      authEl(
        'rajAuthScreen'
      );


    if(screen){

      return screen;

    }


    screen =
      document.createElement(
        'div'
      );


    screen.id =
      'rajAuthScreen';


    screen.innerHTML = `

      <div class="raj-auth-box">

        <div class="raj-auth-logo">
          R
        </div>


        <h1 class="raj-auth-title">
          Raj Agencies
        </h1>


        <div class="raj-auth-subtitle">
          Sales Intelligence Dashboard
        </div>


        <form id="rajLoginForm">


          <div class="raj-auth-field">

            <label>
              Mobile Number
            </label>

            <input
              id="rajLoginMobile"
              type="tel"
              inputmode="numeric"
              maxlength="10"
              autocomplete="username"
              placeholder="Enter 10 digit mobile number"
              required
            >

          </div>


          <div class="raj-auth-field">

            <label>
              Password
            </label>

            <input
              id="rajLoginPassword"
              type="password"
              autocomplete="current-password"
              placeholder="Enter password"
              required
            >

          </div>


          <button
            id="rajLoginButton"
            type="submit"
          >
            Login
          </button>


          <div id="rajLoginMessage"></div>


        </form>


        <div class="raj-auth-footer">
          Authorized Raj Agencies users only
        </div>

      </div>

    `;


    document.body.appendChild(
      screen
    );


    authEl(
      'rajLoginForm'
    )
      ?.addEventListener(
        'submit',
        handleLogin
      );


    const mobileInput =
      authEl(
        'rajLoginMobile'
      );


    mobileInput
      ?.addEventListener(
        'input',
        () => {

          mobileInput.value =
            mobileInput.value
              .replace(
                /\D/g,
                ''
              )
              .slice(
                0,
                10
              );

        }
      );


    return screen;

  }


  function showLogin(
    message = ''
  ){

    lockDashboard();


    const screen =
      createLoginScreen();


    screen.style.display =
      'flex';


    const msg =
      authEl(
        'rajLoginMessage'
      );


    if(msg){

      msg.textContent =
        message;


      msg.className =
        message
          ? 'raj-auth-error'
          : '';

    }

  }


  function hideLogin(){

    const screen =
      authEl(
        'rajAuthScreen'
      );


    if(screen){

      screen.style.display =
        'none';

    }


    unlockDashboard();

  }


  /* =========================================================
     RPC
     ========================================================= */

  async function authRpc(
    name,
    params
  ){

    if(
      typeof sb
        === 'undefined'
      ||
      !sb
    ){

      throw new Error(
        'Supabase client not ready.'
      );

    }


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


  /* =========================================================
     LOGIN
     ========================================================= */

  async function handleLogin(
    event
  ){

    event.preventDefault();


    const mobile =
      (
        authEl(
          'rajLoginMobile'
        )
          ?.value
        ||
        ''
      )
        .trim();


    const password =
      authEl(
        'rajLoginPassword'
      )
        ?.value
      ||
      '';


    const button =
      authEl(
        'rajLoginButton'
      );


    const message =
      authEl(
        'rajLoginMessage'
      );


    if(
      mobile.length !== 10
    ){

      message.textContent =
        'Enter valid 10 digit mobile number.';


      message.className =
        'raj-auth-error';


      return;

    }


    if(!password){

      message.textContent =
        'Enter password.';


      message.className =
        'raj-auth-error';


      return;

    }


    /*
      Remove previous browser session token.
      Device ID is intentionally retained.
    */

    clearSession();


    button.disabled =
      true;


    button.textContent =
      'Checking...';


    message.textContent =
      '';


    try{

      const data =
        await authRpc(
          'raj_app_login',
          {

            p_mobile:
              mobile,

            p_pin:
              password,

            p_device_id:
              getDeviceId(),

            p_browser_info:
              navigator.userAgent

          }
        );


      if(
        !data
        ||
        data.success !== true
      ){

        clearSession();


        showLogin(
          data?.message
          ||
          'Login failed.'
        );


        return;

      }


      rajAuthUser =
        data.user;


      saveSession(
        data.session_token,
        data.user
      );


      message.textContent =
        'Login successful.';


      message.className =
        'raj-auth-success';


      await activateUser(
        data.user
      );


      hideLogin();


    }catch(error){

      clearSession();


      console.error(
        'Login error:',
        error
      );


      showLogin(
        error?.message
        ||
        'Unable to login.'
      );


    }finally{

      button.disabled =
        false;


      button.textContent =
        'Login';

    }

  }


  /* =========================================================
     VALIDATE SESSION
     ========================================================= */

  async function validateSavedSession(){

    const token =
      getSessionToken();


    if(!token){

      clearSession();

      return false;

    }


    try{

      const data =
        await authRpc(
          'raj_app_validate_session',
          {

            p_session_token:
              token,

            p_device_id:
              getDeviceId()

          }
        );


      if(
        !data
        ||
        data.success !== true
      ){

        clearSession();

        return false;

      }


      rajAuthUser =
        data.user;


      localStorage.setItem(
        AUTH_USER_KEY,
        JSON.stringify(
          data.user
        )
      );


      await activateUser(
        data.user
      );


      return true;


    }catch(error){

      console.error(
        'Session validation error:',
        error
      );


      clearSession();


      return false;

    }

  }


  /* =========================================================
     ROLE HELPERS
     ========================================================= */

  function currentRole(){

    return String(
      rajAuthUser?.role
      ||
      ''
    );

  }


  function isFullUser(){

    return (
      currentRole()
        === 'Admin'
      ||
      rajAuthUser?.full_view
        === true
    );

  }


  function allowedSM(){

    return uniqueCodes(
      rajAuthUser?.sm_access
    )
      .filter(
        value =>
          value !== 'ALL'
      );

  }


  function allowedOD(){

    return uniqueCodes(
      rajAuthUser?.od_access
    )
      .filter(
        value =>
          value !== 'ALL'
      );

  }


  function intersectSelection(
    current,
    allowed
  ){

    const allowedSet =
      new Set(
        allowed.map(
          String
        )
      );


    return uniqueCodes(
      current
    )
      .filter(
        value =>
          allowedSet.has(
            String(value)
          )
      );

  }


  /* =========================================================
     ENFORCE ROLE SELECTION
     ========================================================= */

  function enforceRoleSelections(){

    if(
      !rajAuthUser
      ||
      typeof selected
        === 'undefined'
    ){

      return;

    }


    if(
      isFullUser()
    ){

      return;

    }


    const role =
      currentRole();


    const sm =
      allowedSM();


    const od =
      allowedOD();


    /*
      =====================================================
      SM USER

      Example access:
      DH + RM

      Initial:
      DH + RM

      Then user may select:
      DH only
      RM only
      DH + RM

      If selection becomes empty:
      interpret it as ALL ALLOWED,
      not ALL COMPANY.
      =====================================================
    */

    if(
      role === 'SM'
    ){

      const valid =
        intersectSelection(
          selected.SM,
          sm
        );


      selected.SM =
        valid.length
          ? valid
          : [...sm];


      /*
        SM user cannot use OD role scope.
      */

      selected.budgetOD =
        [];

    }


    /*
      =====================================================
      OD USER
      =====================================================
    */

    if(
      role === 'OD'
    ){

      const valid =
        intersectSelection(
          selected.budgetOD,
          od
        );


      selected.budgetOD =
        valid.length
          ? valid
          : [...od];


      selected.SM =
        [];

    }


    /*
      =====================================================
      SALES HEAD
      =====================================================
    */

    if(
      role === 'SalesHead'
    ){

      if(sm.length){

        const validSM =
          intersectSelection(
            selected.SM,
            sm
          );


        selected.SM =
          validSM.length
            ? validSM
            : [...sm];

      }


      if(od.length){

        const validOD =
          intersectSelection(
            selected.budgetOD,
            od
          );


        selected.budgetOD =
          validOD.length
            ? validOD
            : [...od];

      }

    }


    /*
      Update visible labels.
    */

    try{

      if(
        typeof updateMultiLabel
          === 'function'
      ){

        updateMultiLabel(
          'SM'
        );

      }

    }catch(_){}


    try{

      if(
        typeof updateODLabel
          === 'function'
      ){

        updateODLabel();

      }

    }catch(_){}

  }


  /* =========================================================
     REMOVE UNAUTHORIZED OPTIONS
     ========================================================= */

  function restrictOptionContainer(
    optionsId,
    allowed
  ){

    const container =
      authEl(
        optionsId
      );


    if(!container){

      return;

    }


    const allowedSet =
      new Set(
        allowed.map(
          value =>
            String(value)
        )
      );


    container
      .querySelectorAll(
        '.multi-option'
      )
      .forEach(
        option => {

          const checkbox =
            option.querySelector(
              'input[type="checkbox"]'
            );


          if(!checkbox){

            return;

          }


          if(
            !allowedSet.has(
              String(
                checkbox.value
              )
            )
          ){

            option.remove();

          }

        }
      );

  }


  function addRestrictionNote(
    multiId,
    text
  ){

    const multi =
      authEl(
        multiId
      );


    if(!multi){

      return;

    }


    const field =
      multi.closest(
        '.field'
      );


    if(!field){

      return;

    }


    let note =
      field.querySelector(
        '.raj-role-restricted-note'
      );


    if(!note){

      note =
        document.createElement(
          'small'
        );


      note.className =
        'raj-role-restricted-note';


      field.appendChild(
        note
      );

    }


    note.textContent =
      text;

  }


  function applyRoleUI(){

    if(
      !rajAuthUser
    ){

      return;

    }


    const role =
      currentRole();


    if(
      isFullUser()
    ){

      return;

    }


    if(
      role === 'SM'
    ){

      const sm =
        allowedSM();


      restrictOptionContainer(
        'options_SM',
        sm
      );


      /*
        IMPORTANT:
        Do NOT disable SM control.
        User must be able to select
        DH only / RM only / both.
      */

      const smMulti =
        authEl(
          'multi_SM'
        );


      if(smMulti){

        smMulti.style.opacity =
          '1';


        smMulti
          .querySelectorAll(
            'button,input'
          )
          .forEach(
            node => {

              node.disabled =
                false;

            }
          );

      }


      addRestrictionNote(
        'multi_SM',
        'Allowed SM: ' +
        sm.join(', ')
      );


      /*
        OD isn't assigned to SM role.
      */

      const odMulti =
        authEl(
          'multi_budgetOD'
        );


      if(odMulti){

        odMulti
          .querySelectorAll(
            'button,input'
          )
          .forEach(
            node => {

              node.disabled =
                true;

            }
          );


        odMulti.style.opacity =
          '.55';

      }

    }


    if(
      role === 'OD'
    ){

      const od =
        allowedOD();


      restrictOptionContainer(
        'options_budgetOD',
        od
      );


      const odMulti =
        authEl(
          'multi_budgetOD'
        );


      if(odMulti){

        odMulti.style.opacity =
          '1';


        odMulti
          .querySelectorAll(
            'button,input'
          )
          .forEach(
            node => {

              node.disabled =
                false;

            }
          );

      }


      addRestrictionNote(
        'multi_budgetOD',
        'Allowed OD: ' +
        od.join(', ')
      );

    }


    if(
      role === 'SalesHead'
    ){

      const sm =
        allowedSM();


      const od =
        allowedOD();


      if(sm.length){

        restrictOptionContainer(
          'options_SM',
          sm
        );


        addRestrictionNote(
          'multi_SM',
          'Allowed SM: ' +
          sm.join(', ')
        );

      }


      if(od.length){

        restrictOptionContainer(
          'options_budgetOD',
          od
        );


        addRestrictionNote(
          'multi_budgetOD',
          'Allowed OD: ' +
          od.join(', ')
        );

      }

    }

  }


  /* =========================================================
     USER HEADER
     ========================================================= */

  function renderUserArea(){

    if(
      !rajAuthUser
    ){

      return;

    }


    let area =
      authEl(
        'rajUserArea'
      );


    if(!area){

      area =
        document.createElement(
          'div'
        );


      area.id =
        'rajUserArea';


      const topbar =
        document.querySelector(
          '.topbar'
        );


      if(topbar){

        topbar.appendChild(
          area
        );

      }

    }


    const name =
      String(
        rajAuthUser.name
        ||
        'User'
      );


    const sm =
      normalizeCodes(
        rajAuthUser.sm_access
      );


    const od =
      normalizeCodes(
        rajAuthUser.od_access
      );


    let accessText =
      currentRole();


    if(
      currentRole()
        === 'SM'
      &&
      !sm.includes(
        'ALL'
      )
    ){

      accessText +=
        ' • ' +
        sm.join(', ');

    }


    if(
      currentRole()
        === 'OD'
      &&
      !od.includes(
        'ALL'
      )
    ){

      accessText +=
        ' • ' +
        od.join(', ');

    }


    if(
      currentRole()
        === 'SalesHead'
    ){

      const parts = [];


      if(sm.length){

        parts.push(
          'SM: ' +
          sm.join(', ')
        );

      }


      if(od.length){

        parts.push(
          'OD: ' +
          od.join(', ')
        );

      }


      if(parts.length){

        accessText +=
          ' • ' +
          parts.join(' • ');

      }

    }


    area.innerHTML = `

      <div class="raj-user-card">

        <div class="raj-user-avatar">
          ${escapeHtml(
            name
              .charAt(0)
              .toUpperCase()
          )}
        </div>


        <div class="raj-user-text">

          <div class="raj-user-name">
            ${escapeHtml(name)}
          </div>

          <div class="raj-user-role">
            ${escapeHtml(accessText)}
          </div>

        </div>

      </div>


      <button
        type="button"
        id="rajLogoutBtn"
      >
        Logout
      </button>

    `;


    authEl(
      'rajLogoutBtn'
    )
      ?.addEventListener(
        'click',
        handleLogout
      );

  }


  /* =========================================================
     ACCESS BADGE
     ========================================================= */

  function renderAccessBadge(){

    const hero =
      document.querySelector(
        '.hero'
      );


    if(
      !hero
      ||
      !rajAuthUser
    ){

      return;

    }


    let badge =
      authEl(
        'rajAccessBadge'
      );


    if(!badge){

      badge =
        document.createElement(
          'div'
        );


      badge.id =
        'rajAccessBadge';


      hero.insertAdjacentElement(
        'afterend',
        badge
      );

    }


    const role =
      currentRole();


    const sm =
      normalizeCodes(
        rajAuthUser.sm_access
      );


    const od =
      normalizeCodes(
        rajAuthUser.od_access
      );


    if(
      role === 'Admin'
      ||
      rajAuthUser.full_view
        === true
    ){

      badge.textContent =
        `Logged in as ${rajAuthUser.name} • Admin • Full Company Access`;


      return;

    }


    if(
      role === 'SM'
    ){

      badge.textContent =
        `Logged in as ${rajAuthUser.name} • SM Access: ${sm.join(', ')}`;


      return;

    }


    if(
      role === 'OD'
    ){

      badge.textContent =
        `Logged in as ${rajAuthUser.name} • OD Access: ${od.join(', ')}`;


      return;

    }


    if(
      role === 'SalesHead'
    ){

      const parts = [];


      if(sm.length){

        parts.push(
          'SM: ' +
          sm.join(', ')
        );

      }


      if(od.length){

        parts.push(
          'OD: ' +
          od.join(', ')
        );

      }


      badge.textContent =
        `Logged in as ${rajAuthUser.name} • Sales Head • ${parts.join(' • ')}`;


      return;

    }


    badge.textContent =
      `Logged in as ${rajAuthUser.name} • ${role}`;

  }


  /* =========================================================
     PROTECT MAIN DASHBOARD
     ========================================================= */

  function protectDashboardLoader(){

    if(
      dashboardProtected
    ){

      return true;

    }


    if(
      typeof loadDashboard
        !== 'function'
    ){

      return false;

    }


    const originalLoadDashboard =
      loadDashboard;


    loadDashboard =
      async function(
        ...args
      ){

        /*
          No authenticated session:
          never load business data.
        */

        if(
          !rajAuthUser
        ){

          return;

        }


        /*
          Make sure selected values
          are inside role permission.
        */

        enforceRoleSelections();


        const result =
          await originalLoadDashboard
            .apply(
              this,
              args
            );


        /*
          Main script may rebuild filter HTML.
          Restrict it again after rebuild.
        */

        enforceRoleSelections();


        applyRoleUI();


        return result;

      };


    dashboardProtected =
      true;


    return true;

  }


  /* =========================================================
     PROTECT ANALYSIS VIEW
     ========================================================= */

  function protectAnalysisLoader(){

    if(
      analysisProtected
    ){

      return true;

    }


    if(
      typeof loadGroupSummary
        !== 'function'
    ){

      return false;

    }


    const originalLoadGroupSummary =
      loadGroupSummary;


    loadGroupSummary =
      async function(
        ...args
      ){

        if(
          !rajAuthUser
        ){

          return;

        }


        /*
          Critical:
          Analysis always uses current
          allowed selected SM/OD.
        */

        enforceRoleSelections();


        const result =
          await originalLoadGroupSummary
            .apply(
              this,
              args
            );


        return result;

      };


    analysisProtected =
      true;


    return true;

  }


  /* =========================================================
     INSTALL SAFE PROTECTIONS
     ========================================================= */

  function installProtections(){

    let attempts =
      0;


    const timer =
      setInterval(
        () => {

          attempts++;


          const dashboardOk =
            protectDashboardLoader();


          const analysisOk =
            protectAnalysisLoader();


          if(
            (
              dashboardOk
              &&
              analysisOk
            )
            ||
            attempts >= 100
          ){

            clearInterval(
              timer
            );

          }

        },
        50
      );

  }


  /* =========================================================
     REFRESH AFTER LOGIN
     ========================================================= */

  async function refreshVisibleDashboard(){

    if(
      rajAuthRefreshing
      ||
      typeof loadDashboard
        !== 'function'
    ){

      return;

    }


    rajAuthRefreshing =
      true;


    try{

      enforceRoleSelections();


      if(
        typeof page
          !== 'undefined'
      ){

        page =
          1;

      }


      if(
        typeof budgetPage
          !== 'undefined'
      ){

        budgetPage =
          1;

      }


      await loadDashboard(
        true
      );


      enforceRoleSelections();


      applyRoleUI();


    }catch(error){

      console.error(
        'Role dashboard refresh error:',
        error
      );


    }finally{

      rajAuthRefreshing =
        false;

    }

  }


  /* =========================================================
     ACTIVATE USER
     ========================================================= */

  async function activateUser(
    user
  ){

    rajAuthUser =
      user;


    enforceRoleSelections();


    renderUserArea();


    renderAccessBadge();


    setTimeout(
      async () => {

        enforceRoleSelections();


        await refreshVisibleDashboard();


        applyRoleUI();

      },
      250
    );


    /*
      Main script can rebuild filters
      during initial load.
    */

    setTimeout(
      () => {

        enforceRoleSelections();

        applyRoleUI();

      },
      1000
    );


    setTimeout(
      () => {

        enforceRoleSelections();

        applyRoleUI();

      },
      2000
    );

  }


  /* =========================================================
     LOGOUT
     ========================================================= */

  async function handleLogout(){

    const token =
      getSessionToken();


    const deviceId =
      getDeviceId();


    lockDashboard();


    try{

      if(token){

        await authRpc(
          'raj_app_logout',
          {

            p_session_token:
              token,

            p_device_id:
              deviceId

          }
        );

      }


    }catch(error){

      console.error(
        'Logout error:',
        error
      );

    }


    clearSession();


    window.location.replace(

      window.location.pathname

      +

      '?auth='

      +

      Date.now()

    );

  }


  /* =========================================================
     PAGE RESTORE
     ========================================================= */

  async function recheckAfterPageRestore(){

    lockDashboard();


    const valid =
      await validateSavedSession();


    if(valid){

      hideLogin();

    }else{

      showLogin();

    }

  }


  window.addEventListener(
    'pageshow',
    event => {

      if(
        event.persisted
        ||
        !getSessionToken()
      ){

        recheckAfterPageRestore();

      }else{

        setTimeout(
          () => {

            enforceRoleSelections();

            applyRoleUI();

          },
          300
        );

      }

    }
  );


  document.addEventListener(
    'visibilitychange',
    () => {

      if(
        document.visibilityState
          !== 'visible'
      ){

        return;

      }


      if(
        !getSessionToken()
      ){

        showLogin();

        return;

      }


      setTimeout(
        () => {

          enforceRoleSelections();

          applyRoleUI();

        },
        150
      );

    }
  );


  /* =========================================================
     KEEP ROLE FILTER SAFE

     Main dashboard rebuilds dropdown options.
     This light check only removes unauthorized
     visible options. It does NOT force DH/RM
     back after user selects only RM.
     ========================================================= */

  setInterval(
    () => {

      if(
        !rajAuthUser
      ){

        return;

      }


      applyRoleUI();

    },
    1200
  );


  /* =========================================================
     START AUTH
     ========================================================= */

  async function startAuth(){

    if(
      rajAuthStarted
    ){

      return;

    }


    rajAuthStarted =
      true;


    lockDashboard();


    addAuthStyles();


    createLoginScreen();


    /*
      IMPORTANT:
      Only wrap safe function declarations.

      We DO NOT reassign:
      rawBudgetArgs
      args
      budgetArgs
      comparisonBaseArgs

      Therefore no:
      "Assignment to constant variable"
      error.
    */

    installProtections();


    const valid =
      await validateSavedSession();


    if(valid){

      hideLogin();

    }else{

      showLogin();

    }

  }


  if(
    document.readyState
      === 'loading'
  ){

    document.addEventListener(
      'DOMContentLoaded',
      startAuth,
      {
        once:true
      }
    );

  }else{

    startAuth();

  }


})();

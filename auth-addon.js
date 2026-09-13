/* ============================================================
   RAJ AGENCIES
   AUTH + ROLE ACCESS ADDON
   Mobile Login + Device Lock + SM/OD Permission
   ============================================================ */


(() => {

  'use strict';


  /* =========================================================
     BASIC STATE
     ========================================================= */

  const AUTH_DEVICE_KEY =
    'raj_dashboard_device_id';

  const AUTH_SESSION_KEY =
    'raj_dashboard_session_token';

  const AUTH_USER_KEY =
    'raj_dashboard_user';


  let rajAuthUser = null;

  let rajAuthReady = false;

  let rajAuthRefreshing = false;



  /* =========================================================
     HELPERS
     ========================================================= */

  const authEl = id =>
    document.getElementById(id);


  function safeJsonParse(value){

    try{

      return JSON.parse(value);

    }catch{

      return null;

    }

  }



  /* =========================================================
     DEVICE ID
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
      window.crypto &&
      typeof crypto.randomUUID === 'function'
    ){

      deviceId =
        crypto.randomUUID();

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
     SAVED SESSION
     ========================================================= */

  function getSessionToken(){

    return (
      localStorage.getItem(
        AUTH_SESSION_KEY
      ) || ''
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
      JSON.stringify(user || {})
    );

  }


  function clearSession(){

    localStorage.removeItem(
      AUTH_SESSION_KEY
    );

    localStorage.removeItem(
      AUTH_USER_KEY
    );

    rajAuthUser = null;

  }



  /* =========================================================
     LOGIN PAGE CSS
     ========================================================= */

  function addAuthStyles(){

    if(
      document.getElementById(
        'rajAuthStyles'
      )
    ){

      return;

    }


    const style =
      document.createElement('style');


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
        width:min(440px,100%);

        background:
          rgba(255,255,255,.80);

        backdrop-filter:
          blur(28px);

        -webkit-backdrop-filter:
          blur(28px);

        border:
          1px solid
          rgba(255,255,255,.90);

        border-radius:28px;

        box-shadow:
          0 30px 80px
          rgba(54,45,120,.20);

        padding:38px 34px 34px;

        position:relative;

        overflow:hidden;
      }


      .raj-auth-box::before{
        content:"";

        position:absolute;

        width:180px;
        height:180px;

        top:-100px;
        right:-70px;

        border-radius:50%;

        background:
          radial-gradient(
            circle,
            rgba(116,84,244,.25),
            transparent 70%
          );
      }


      .raj-auth-logo{
        width:62px;
        height:62px;

        margin:0 auto 16px;

        display:grid;
        place-items:center;

        border-radius:19px;

        background:
          linear-gradient(
            135deg,
            #4f46e5,
            #7c3aed,
            #b052ef
          );

        color:white;

        font-size:29px;
        font-weight:900;

        box-shadow:
          0 13px 28px
          rgba(99,76,230,.30);
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
        margin-bottom:15px;
      }


      .raj-auth-field label{
        display:block;

        margin-bottom:7px;

        color:#505970;

        font-size:11px;
        font-weight:850;
      }


      .raj-auth-field input{
        width:100%;
        height:49px;

        padding:
          0
          14px;

        border:
          1px solid
          rgba(95,82,170,.18);

        border-radius:13px;

        outline:none;

        background:
          rgba(255,255,255,.88);

        color:#17213c;

        font-size:14px;

        transition:
          border-color .18s,
          box-shadow .18s;
      }


      .raj-auth-field input:focus{
        border-color:
          rgba(95,75,235,.62);

        box-shadow:
          0 0 0 4px
          rgba(95,75,235,.10);
      }


      #rajLoginButton{
        width:100%;
        height:50px;

        margin-top:5px;

        border:0;

        border-radius:14px;

        cursor:pointer;

        color:white;

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
          rgba(89,70,225,.25);

        transition:
          transform .18s,
          box-shadow .18s;
      }


      #rajLoginButton:hover{
        transform:
          translateY(-2px);

        box-shadow:
          0 16px 31px
          rgba(89,70,225,.31);
      }


      #rajLoginButton:disabled{
        opacity:.6;
        cursor:not-allowed;
        transform:none;
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
          rgba(100,90,160,.10);

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
          rgba(100,90,180,.10);

        border-radius:999px;

        background:
          rgba(255,255,255,.72);
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
        min-width:80px;
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

        border-radius:999px;

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
          rgba(100,82,225,.10);

        background:
          linear-gradient(
            90deg,
            rgba(239,237,255,.84),
            rgba(249,245,255,.75)
          );

        color:#5648c7;

        font-size:11px;
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
     CREATE LOGIN SCREEN
     ========================================================= */

  function createLoginScreen(){

    if(authEl('rajAuthScreen')){

      return;

    }


    document.body.classList.add(
      'raj-auth-locked'
    );


    const screen =
      document.createElement('div');


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


          <div
            id="rajLoginMessage"
          ></div>

        </form>


        <div class="raj-auth-footer">
          Authorized Raj Agencies users only
        </div>

      </div>

    `;


    document.body.appendChild(
      screen
    );


    authEl('rajLoginForm')
      .addEventListener(
        'submit',
        handleLogin
      );


    const mobileInput =
      authEl('rajLoginMobile');


    mobileInput.addEventListener(
      'input',
      () => {

        mobileInput.value =
          mobileInput.value
            .replace(/\D/g,'')
            .slice(0,10);

      }
    );

  }



  /* =========================================================
     SHOW LOGIN
     ========================================================= */

  function showLogin(message = ''){

    createLoginScreen();


    const screen =
      authEl('rajAuthScreen');


    if(screen){

      screen.style.display =
        'flex';

    }


    document.body.classList.add(
      'raj-auth-locked'
    );


    const msg =
      authEl('rajLoginMessage');


    if(msg){

      msg.textContent =
        message;

      msg.className =
        message
          ? 'raj-auth-error'
          : '';

    }

  }



  /* =========================================================
     HIDE LOGIN
     ========================================================= */

  function hideLogin(){

    const screen =
      authEl('rajAuthScreen');


    if(screen){

      screen.style.display =
        'none';

    }


    document.body.classList.remove(
      'raj-auth-locked'
    );

  }



  /* =========================================================
     RPC DIRECT
     ========================================================= */

  async function authRpc(
    name,
    params
  ){

    if(
      typeof sb === 'undefined'
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

  async function handleLogin(event){

    event.preventDefault();


    const mobile =
      (
        authEl('rajLoginMobile')
          ?.value
        || ''
      ).trim();


    const password =
      (
        authEl('rajLoginPassword')
          ?.value
        || ''
      );


    const button =
      authEl('rajLoginButton');


    const message =
      authEl('rajLoginMessage');


    if(mobile.length !== 10){

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

        message.textContent =
          data?.message
          ||
          'Login failed.';

        message.className =
          'raj-auth-error';

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

      console.error(
        'Login error:',
        error
      );


      message.textContent =
        error?.message
        ||
        'Unable to login.';

      message.className =
        'raj-auth-error';

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


      return false;

    }

  }



  /* =========================================================
     NORMALIZE ACCESS
     ========================================================= */

  function normalizeCodes(value){

    if(!Array.isArray(value)){

      return [];

    }


    return value

      .map(
        x =>
          String(
            x ?? ''
          ).trim()
      )

      .filter(Boolean);

  }



  /* =========================================================
     APPLY ROLE ACCESS
     ========================================================= */

  function forceRoleSelections(){

    if(
      !rajAuthUser
      ||
      typeof selected === 'undefined'
    ){

      return;

    }


    const role =
      String(
        rajAuthUser.role || ''
      );


    const fullView =
      rajAuthUser.full_view === true;


    const smAccess =
      normalizeCodes(
        rajAuthUser.sm_access
      );


    const odAccess =
      normalizeCodes(
        rajAuthUser.od_access
      );


    /* ADMIN / FULL VIEW */

    if(
      role === 'Admin'
      ||
      fullView
      ||
      smAccess.includes('ALL')
      ||
      odAccess.includes('ALL')
    ){

      return;

    }


    /* SM ROLE */

    if(role === 'SM'){

      selected.SM =
        [...smAccess];


      selected.budgetOD =
        [];

    }


    /* OD ROLE */

    if(role === 'OD'){

      selected.SM =
        [];


      selected.budgetOD =
        [...odAccess];

    }


    /* SALES HEAD */

    if(role === 'SalesHead'){

      if(smAccess.length){

        selected.SM =
          [...smAccess];

      }


      if(odAccess.length){

        selected.budgetOD =
          [...odAccess];

      }

    }

  }



  /* =========================================================
     DISABLE ROLE FILTER UI
     ========================================================= */

  function lockRoleFilterUI(){

    if(!rajAuthUser){

      return;

    }


    const role =
      String(
        rajAuthUser.role || ''
      );


    const fullView =
      rajAuthUser.full_view === true;


    if(
      role === 'Admin'
      ||
      fullView
    ){

      return;

    }


    /* SM dropdown */

    if(
      role === 'SM'
      ||
      role === 'SalesHead'
    ){

      const multi =
        authEl('multi_SM');


      if(multi){

        multi.style.opacity =
          '.72';


        multi
          .querySelectorAll(
            'input,button'
          )
          .forEach(
            node => {

              node.disabled =
                true;

            }
          );

      }

    }


    /* OD dropdown */

    if(
      role === 'OD'
      ||
      role === 'SalesHead'
    ){

      const multi =
        authEl(
          'multi_budgetOD'
        );


      if(multi){

        multi.style.opacity =
          '.72';


        multi
          .querySelectorAll(
            'input,button'
          )
          .forEach(
            node => {

              node.disabled =
                true;

            }
          );

      }

    }

  }



  /* =========================================================
     USER HEADER DISPLAY
     ========================================================= */

  function renderUserArea(){

    if(!rajAuthUser){

      return;

    }


    let area =
      authEl('rajUserArea');


    if(!area){

      area =
        document.createElement('div');


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
        rajAuthUser.name || 'User'
      );


    const firstLetter =
      name
        .charAt(0)
        .toUpperCase();


    const sm =
      normalizeCodes(
        rajAuthUser.sm_access
      );


    const od =
      normalizeCodes(
        rajAuthUser.od_access
      );


    let accessText =
      rajAuthUser.role;


    if(
      rajAuthUser.role === 'SM'
      &&
      !sm.includes('ALL')
    ){

      accessText +=
        ' • ' +
        sm.join(', ');

    }


    if(
      rajAuthUser.role === 'OD'
      &&
      !od.includes('ALL')
    ){

      accessText +=
        ' • ' +
        od.join(', ');

    }


    area.innerHTML = `

      <div class="raj-user-card">

        <div class="raj-user-avatar">
          ${firstLetter}
        </div>

        <div class="raj-user-text">

          <div class="raj-user-name">
            ${escapeAuthHtml(name)}
          </div>

          <div class="raj-user-role">
            ${escapeAuthHtml(accessText)}
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


    authEl('rajLogoutBtn')
      ?.addEventListener(
        'click',
        handleLogout
      );

  }



  function escapeAuthHtml(value){

    const div =
      document.createElement('div');


    div.textContent =
      String(value ?? '');


    return div.innerHTML;

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
      authEl('rajAccessBadge');


    if(!badge){

      badge =
        document.createElement('div');


      badge.id =
        'rajAccessBadge';


      hero.insertAdjacentElement(
        'afterend',
        badge
      );

    }


    const role =
      rajAuthUser.role;


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
      rajAuthUser.full_view === true
    ){

      badge.textContent =
        `Logged in as ${rajAuthUser.name} • Admin • Full Company Access`;

      return;

    }


    if(role === 'SM'){

      badge.textContent =
        `Logged in as ${rajAuthUser.name} • SM Access: ${sm.join(', ')}`;

      return;

    }


    if(role === 'OD'){

      badge.textContent =
        `Logged in as ${rajAuthUser.name} • OD Access: ${od.join(', ')}`;

      return;

    }


    badge.textContent =
      `Logged in as ${rajAuthUser.name} • ${role}`;

  }



  /* =========================================================
     ACTIVATE USER
     ========================================================= */

  async function activateUser(user){

    rajAuthUser =
      user;


    forceRoleSelections();


    renderUserArea();

    renderAccessBadge();


    /* Wait until dashboard filters exist */

    setTimeout(
      () => {

        forceRoleSelections();

        lockRoleFilterUI();

        refreshVisibleDashboard();

      },
      300
    );


    setTimeout(
      () => {

        forceRoleSelections();

        lockRoleFilterUI();

      },
      1000
    );

  }



  /* =========================================================
     REFRESH DASHBOARD
     ========================================================= */

  async function refreshVisibleDashboard(){

    if(rajAuthRefreshing){

      return;

    }


    if(
      typeof loadDashboard
      !== 'function'
    ){

      return;

    }


    rajAuthRefreshing =
      true;


    try{

      forceRoleSelections();


      page = 1;


      if(
        typeof budgetPage
        !== 'undefined'
      ){

        budgetPage = 1;

      }


      await loadDashboard(false);


    }catch(error){

      console.error(
        'Role refresh error:',
        error
      );


    }finally{

      rajAuthRefreshing =
        false;

    }

  }



  /* =========================================================
     PROTECT loadDashboard
     ========================================================= */

  function protectDashboardLoader(){

    if(
      typeof loadDashboard
      !== 'function'
    ){

      return false;

    }


    if(
      loadDashboard
        .__rajAuthProtected
    ){

      return true;

    }


    const originalLoadDashboard =
      loadDashboard;


    const protectedLoader =
      async function(...args){

        if(!rajAuthUser){

          return;

        }


        forceRoleSelections();


        const result =
          await originalLoadDashboard
            .apply(
              this,
              args
            );


        forceRoleSelections();

        lockRoleFilterUI();


        return result;

      };


    protectedLoader
      .__rajAuthProtected =
      true;


    loadDashboard =
      protectedLoader;


    return true;

  }



  /* =========================================================
     PROTECT NORMAL FILTER OBJECT
     ========================================================= */

  function protectNormalFilterObject(){

    if(
      typeof normalFilterObject
      !== 'function'
    ){

      return false;

    }


    if(
      normalFilterObject
        .__rajAuthProtected
    ){

      return true;

    }


    const original =
      normalFilterObject;


    const wrapped =
      function(){

        forceRoleSelections();


        const obj =
          original();


        if(!rajAuthUser){

          return obj;

        }


        const role =
          rajAuthUser.role;


        const full =
          rajAuthUser.full_view
          === true;


        if(
          role === 'Admin'
          ||
          full
        ){

          return obj;

        }


        const sm =
          normalizeCodes(
            rajAuthUser.sm_access
          );


        const od =
          normalizeCodes(
            rajAuthUser.od_access
          );


        if(role === 'SM'){

          obj.SM =
            [...sm];

        }


        if(
          role === 'SalesHead'
          &&
          sm.length
        ){

          obj.SM =
            [...sm];

        }


        return obj;

      };


    wrapped.__rajAuthProtected =
      true;


    normalFilterObject =
      wrapped;


    return true;

  }



  /* =========================================================
     PROTECT RAW BUDGET ARGS
     ========================================================= */

  function protectBudgetArgs(){

    if(
      typeof rawBudgetArgs
      !== 'function'
    ){

      return false;

    }


    if(
      rawBudgetArgs
        .__rajAuthProtected
    ){

      return true;

    }


    const original =
      rawBudgetArgs;


    const wrapped =
      function(){

        forceRoleSelections();


        const result =
          original();


        if(!rajAuthUser){

          return result;

        }


        const role =
          rajAuthUser.role;


        if(
          role === 'Admin'
          ||
          rajAuthUser.full_view === true
        ){

          return result;

        }


        const sm =
          normalizeCodes(
            rajAuthUser.sm_access
          );


        const od =
          normalizeCodes(
            rajAuthUser.od_access
          );


        if(role === 'SM'){

          result.p_sms =
            sm.length
              ? sm
              : [
                  '__RAJ_NO_ACCESS__'
                ];

        }


        if(role === 'OD'){

          result.p_ods =
            od.length
              ? od
              : [
                  '__RAJ_NO_ACCESS__'
                ];

        }


        if(role === 'SalesHead'){

          if(sm.length){

            result.p_sms =
              [...sm];

          }


          if(od.length){

            result.p_ods =
              [...od];

          }

        }


        return result;

      };


    wrapped.__rajAuthProtected =
      true;


    rawBudgetArgs =
      wrapped;


    return true;

  }



  /* =========================================================
     LOGOUT
     ========================================================= */

  async function handleLogout(){

    const token =
      getSessionToken();


    const deviceId =
      getDeviceId();


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


    location.reload();

  }



  /* =========================================================
     START AUTH
     ========================================================= */

  async function startAuth(){

    addAuthStyles();


    createLoginScreen();


    /*
      Protect dashboard functions.
      Poll only until JS functions are ready.
    */

    let attempts = 0;


    const protectTimer =
      setInterval(
        () => {

          attempts++;


          const a =
            protectDashboardLoader();

          const b =
            protectNormalFilterObject();

          const c =
            protectBudgetArgs();


          if(
            (a && b && c)
            ||
            attempts > 50
          ){

            clearInterval(
              protectTimer
            );

          }

        },
        100
      );


    const valid =
      await validateSavedSession();


    rajAuthReady =
      true;


    if(valid){

      hideLogin();

    }else{

      showLogin();

    }

  }



  /* =========================================================
     START
     ========================================================= */

  if(
    document.readyState ===
    'loading'
  ){

    document.addEventListener(
      'DOMContentLoaded',
      startAuth
    );

  }else{

    startAuth();

  }


})();

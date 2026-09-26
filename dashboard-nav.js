(function(){
  'use strict';
  function init(){
    document.querySelectorAll('.dash-filter-collapse').forEach(function(btn){
      var host=btn.closest('#salesFilterPanel, .sidebar, .ds-sidebar');
      if(!host) return;
      var key='raj_filters_collapsed_'+(location.pathname.split('/').pop()||'index.html');
      var collapsed=localStorage.getItem(key)==='1';
      function paint(){
        host.classList.toggle('dash-filters-collapsed',collapsed);
        btn.setAttribute('aria-expanded',collapsed?'false':'true');
        btn.textContent=collapsed?'Show ▾':'Hide ▴';
      }
      paint();
      btn.addEventListener('click',function(e){
        e.preventDefault(); e.stopPropagation();
        collapsed=!collapsed;
        localStorage.setItem(key,collapsed?'1':'0');
        paint();
      });
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();

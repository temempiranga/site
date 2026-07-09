(function () {
  var match = document.cookie.match(/(__cf_ray|cf-ray)=([^;]+)/);
  if (!match) {
    var meta = document.querySelector('meta[name="cf-ray"]');
    if (meta) match = [null, null, meta.content];
  }
  if (match && match[2]) {
    var el = document.getElementById('rayid');
    if (el) el.textContent = 'Ray ID: ' + match[2];
  }
})();

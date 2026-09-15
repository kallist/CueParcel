/*
 * CueParcel landing page — the only script on this page.
 *
 * Purpose: a GIF keeps animating on its own and cannot be stopped by CSS, so
 * "prefers-reduced-motion: reduce" is honoured here by showing a still frame
 * of the recording instead of the animation.
 *
 * How the still frame is produced, in order:
 *   1. Fetch the GIF bytes and decode the first frame. Works when the site is
 *      served (GitHub Pages / any web server).
 *   2. Fetch the image and draw it to a canvas. Works when the page is opened
 *      straight from the filesystem, where Chrome blocks (1).
 * Both steps verify the frame really produced pixels before the still frame is
 * shown, and the animation is hidden only once a still frame exists. If neither
 * step produces one, the animation is hidden anyway (never played) and a text
 * note takes its place.
 *
 * No analytics, no telemetry, no third-party request: the only bytes fetched
 * are the page's own demo recording.
 */
(function () {
  'use strict';

  var gif = document.querySelector('img.demo-gif');
  var still = document.getElementById('demo-still');
  var note = document.getElementById('demo-motion-note');
  if (!gif || !still) return;

  var query = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (typeof query.matches !== 'boolean') return;

  var stillReady = false;

  function showStill() {
    if (!stillReady || !query.matches) return;
    still.hidden = false;
    gif.hidden = true;
  }

  function showAnimation() {
    still.hidden = true;
    gif.hidden = false;
  }

  function freezeWithoutFrame() {
    // No still frame available: keep the recording out of the way rather than
    // let it loop, and say so instead of showing a broken image.
    still.hidden = true;
    gif.hidden = true;
    if (note) note.hidden = false;
  }

  function publish(source) {
    var canvas = document.createElement('canvas');
    var width = source.naturalWidth || source.width;
    var height = source.naturalHeight || source.height;
    if (!width || !height) return false;

    canvas.width = width;
    canvas.height = height;
    var context = canvas.getContext('2d');
    if (!context) return false;
    context.drawImage(source, 0, 0, width, height);
    if (!context.getImageData(0, 0, 1, 1).data[3]) return false;

    stillReady = true;
    still.addEventListener('load', showStill, { once: true });
    still.src = canvas.toDataURL('image/png');
    if (still.complete) showStill();
    return true;
  }

  function fromFetchedBytes() {
    var request = new XMLHttpRequest();
    request.open('GET', gif.getAttribute('src'), true);
    request.responseType = 'blob';
    request.onload = function () {
      var status = request.status;
      // 0 is the local-file success status; 2xx is the served status.
      if (status !== 0 && (status < 200 || status >= 300)) return;
      var blob = request.response;
      if (!blob) return;

      var dataUrl = URL.createObjectURL(blob);
      var frame = new Image();
      frame.onload = function () {
        if (!publish(frame)) fromImageElement();
        URL.revokeObjectURL(dataUrl);
      };
      frame.onerror = function () {
        URL.revokeObjectURL(dataUrl);
        fromImageElement();
      };
      frame.src = dataUrl;
    };
    request.onerror = fromImageElement;
    request.send();
  }

  function fromImageElement() {
    var probe = new Image();
    probe.onload = function () {
      if (!publish(probe)) freezeWithoutFrame();
    };
    probe.onerror = freezeWithoutFrame;
    probe.src = gif.getAttribute('src');
  }

  function apply() {
    if (!query.matches) {
      showAnimation();
      return;
    }
    if (stillReady) {
      showStill();
      return;
    }
    fromFetchedBytes();
  }

  // A later page load may already have produced the frame.
  still.addEventListener('load', function () {
    stillReady = true;
    showStill();
  });

  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', apply);
  } else if (typeof query.addListener === 'function') {
    query.addListener(apply);
  }

  apply();
})();

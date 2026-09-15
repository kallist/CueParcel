/*
 * CueParcel landing page — the only script on this page.
 *
 * Purpose: a GIF keeps animating on its own, so "prefers-reduced-motion: reduce"
 * has to be honoured.
 *
 * WHO DOES WHAT
 *   CSS (styles.css) owns the preference: a `prefers-reduced-motion: reduce`
 *   media query hides the animation and shows the still frame BEFORE this script
 *   runs, and keeps working with scripting disabled. The still element's `src` is
 *   the recording itself, so even with no script it renders one static frame
 *   rather than an empty box.
 *   THIS SCRIPT only upgrades that still to a cleaner extracted first frame when
 *   the browser lets it, and replies to a preference change at runtime.
 *
 * How the better still frame is produced, in order:
 *   1. Fetch the GIF bytes and decode the first frame. Works when the site is
 *      served (GitHub Pages / any web server).
 *   2. Fetch the image and draw it to a canvas. Works when the page is opened
 *      straight from the filesystem, where Chrome blocks (1).
 * If neither produces a frame, the raw still that CSS already showed stays on
 * screen — never an empty gap and never an animation.
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

  /**
   * The CSS media query is the source of truth for the initial state. This only
   * tracks a preference that CHANGES while the page is open, so it must not fight
   * the stylesheet: when motion is allowed, the raw still is hidden again.
   */
  function showStill() {
    still.hidden = false;
    gif.hidden = true;
  }

  function showAnimation() {
    still.hidden = true;
    gif.hidden = false;
  }

  /** No extractable frame: the raw still already showing is the fallback. */
  function keepRawStill() {
    still.hidden = false;
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
    still.src = canvas.toDataURL('image/png');
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
      if (!publish(probe)) keepRawStill();
    };
    probe.onerror = keepRawStill;
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
    // CSS has already swapped to the raw still; try to improve it.
    fromFetchedBytes();
  }

  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', apply);
  } else if (typeof query.addListener === 'function') {
    query.addListener(apply);
  }

  // Only react to a runtime change; the initial state belongs to the stylesheet.
  if (query.matches && note) note.hidden = false;
})();

/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-178f72ee'], (function (workbox) { 'use strict';

  workbox.setCacheNameDetails({
    prefix: "1584-inventory-7hvj25rueodc4jfgl8xszm"
  });
  self.skipWaiting();
  workbox.clientsClaim();

  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "assets/AddItem.js",
    "revision": null
  }, {
    "url": "assets/AddTransaction.js",
    "revision": null
  }, {
    "url": "assets/BudgetProgress.js",
    "revision": null
  }, {
    "url": "assets/dateUtils.js",
    "revision": null
  }, {
    "url": "assets/EditItem.js",
    "revision": null
  }, {
    "url": "assets/EditTransaction.js",
    "revision": null
  }, {
    "url": "assets/firebase.js",
    "revision": null
  }, {
    "url": "assets/ImageGallery.js",
    "revision": null
  }, {
    "url": "assets/ImagePreview.js",
    "revision": null
  }, {
    "url": "assets/imageService.js",
    "revision": null
  }, {
    "url": "assets/index.css",
    "revision": null
  }, {
    "url": "assets/index.js",
    "revision": null
  }, {
    "url": "assets/inventoryService.js",
    "revision": null
  }, {
    "url": "assets/ItemDetail.js",
    "revision": null
  }, {
    "url": "assets/ProjectDetail.js",
    "revision": null
  }, {
    "url": "assets/Projects.js",
    "revision": null
  }, {
    "url": "assets/router.js",
    "revision": null
  }, {
    "url": "assets/Settings.js",
    "revision": null
  }, {
    "url": "assets/TransactionDetail.js",
    "revision": null
  }, {
    "url": "assets/TransactionItemsList.js",
    "revision": null
  }, {
    "url": "assets/transactionSources.js",
    "revision": null
  }, {
    "url": "assets/ui.js",
    "revision": null
  }, {
    "url": "assets/vendor.js",
    "revision": null
  }, {
    "url": "icon-192x192.png",
    "revision": "281ae70ed7cb4dc914c4ec5ed5c02b3d"
  }, {
    "url": "icon-192x192.svg",
    "revision": "d6cdf2b9e5aabcae08cfc76d17ffd8a6"
  }, {
    "url": "icon-512x512.png",
    "revision": "0f8fd4c52a058aed16e004771175702e"
  }, {
    "url": "icon-512x512.svg",
    "revision": "b84e1517595f5be332066241b3bd0dd1"
  }, {
    "url": "index.html",
    "revision": "c38a8378e3699dc38e421c327d0bf3a3"
  }, {
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
    "url": "/?version=7hvj25rueodc4jfgl8xszm",
    "revision": "7hvj25rueodc4jfgl8xszm"
  }, {
    "url": "icon-192x192.png",
    "revision": "281ae70ed7cb4dc914c4ec5ed5c02b3d"
  }, {
    "url": "icon-512x512.png",
    "revision": "0f8fd4c52a058aed16e004771175702e"
  }, {
    "url": "manifest.webmanifest",
    "revision": "ae65e57c5d23b54f4dcb275e1d98e531"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/^https:\/\/firebasestorage\.googleapis\.com\/.*/i, new workbox.NetworkFirst({
    "cacheName": "firebase-storage-7hvj25rueodc4jfgl8xszm",
    "networkTimeoutSeconds": 3,
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 50,
      maxAgeSeconds: 1800
    })]
  }), 'GET');
  workbox.registerRoute(/\.(?:js|css|html|ico|png|svg|woff|woff2)$/i, new workbox.NetworkFirst({
    "cacheName": "app-assets-7hvj25rueodc4jfgl8xszm",
    "networkTimeoutSeconds": 3,
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 50,
      maxAgeSeconds: 1800
    })]
  }), 'GET');

}));
//# sourceMappingURL=sw.js.map

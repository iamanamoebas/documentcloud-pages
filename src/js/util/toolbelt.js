(function(){

  var DocumentCloud = window.DocumentCloud;
  var Penny         = window.Penny;

  if (DocumentCloud && DocumentCloud._) {
    // Use Underscore if it's available...
    var _ = DocumentCloud._;
  } else if (Penny) {
    // ...but fall back to Penny, which has the bits of Underscore we need here.
    var _ = Penny;
  } else {
    console.error("DocumentCloud embed can't load because of missing components.");
    return false;
  }

  // DCEmbedToolbelt is a small library of components shared between both 
  // the enhance.js embed loader and actual embed libraries. It should remain 
  // very small. It depends on `logger.js` and either `setup.js` (for 
  // Underscore) or Penny.
  var DCEmbedToolbelt = window.DCEmbedToolbelt = window.DCEmbedToolbelt || {

    // Given a valid URL to a DocumentCloud resource, returns an object 
    // identifying the resource's type, the environment of the resource being 
    // requested, and some resource-specific URL components.
    recognizeResource: function(resourceUrl) {

      var domainEnvPatterns = {
        production:  'www\.documentcloud\.org',
        staging:     'staging\.documentcloud\.org',
        development: 'dev\.dcloud\.org'
      };
      var domains = _.values(domainEnvPatterns).join('|');
      var docBase = '(' + domains + ')\/documents\/([0-9]+)-([a-z0-9-]+)';
      var resourceTypePatterns = {
        'document': [
          docBase + '\.(?:html|js|json)$'
        ],
        page: [
          docBase + '\.html#document\/p([0-9]+)$',         // Current
          docBase + '\/pages\/([0-9]+)\.(?:html|js|json)$' // Future?
        ],
        note: [
          docBase + '\/annotations\/([0-9]+)\.(?:html|js|json)$',
          docBase + '\.html#document\/p[0-9]+\/a([0-9]+)$',
          docBase + '\.html#annotation\/a([0-9]+)$'
        ]
      };

      // Figure out which JSON endpoint to hit to access data for a given resource
      var makeDataUrl = function(resource) {
        var urlComponents;

        switch (resource.resourceType) {
          case 'document':
            urlComponents = [resource.domain, 'documents', resource.documentSlug];
            break;
          case 'page':
            urlComponents = [resource.domain, 'documents', resource.documentSlug];
            break;
          case 'note':
            urlComponents = [resource.domain, 'documents', resource.documentSlug, 'annotations', resource.noteId];
            break;
        }

        return '//' + urlComponents.join('/') + '.json';
      };

      var resource = {};
      _.each(resourceTypePatterns, function(patterns, resourceType) {
        if (!_.isEmpty(resource)) { return; } // `_.each` can't be broken out of
        _.each(patterns, function(pattern) {
          if (!_.isEmpty(resource)) { return; } // `_.each` can't be broken out of
          var match = resourceUrl.match(pattern);
          if (match) {
            // Resource-agnostic properties
            resource = {
              resourceUrl:  resourceUrl,
              resourceType: resourceType,
              environment:  _.findKey(domainEnvPatterns, function(domain, env) {
                return resourceUrl.match(domain);
              }),
              domain:       match[1],
              documentId:   match[2],
              documentSlug: match[2] + '-' + match[3],
            };
            // Resource-specific properties
            switch (resourceType) {
              case 'document':
                resource.trackingId = resource.documentId;
                break;
              case 'page':
                resource.pageNumber = match[4];
                resource.trackingId = resource.documentId + 'p' + resource.pageNumber;
                resource.embedOptions = {
                  page: resource.pageNumber
                };
                break;
              case 'note':
                resource.trackingId = resource.noteId = match[4];
                break;
            }
            resource.dataUrl = makeDataUrl(resource);
          }
        });
      });
      return resource;
    },

    // Given a resource or a resource URL, composes and inserts a tracking pixel
    pixelPing: function(resource) {
      // If passed a URL to a resource, convert it to a recognized object
      if (_.isString(resource)) {
        resource = this.recognizeResource(resource);
      }

      var loc = window.location;
      if (loc.protocol == 'file:') { return false; };
      // Effectively strips off any hash
      var sourceUrl = loc.origin + loc.pathname;
      // Treat `foo.com/bar/` and `foo.com/bar` as the same URL
      sourceUrl = sourceUrl.replace(/[\/]+$/, '');

      var pingUrl = '//' + resource.domain + '/pixel.gif';
      var key = encodeURIComponent(resource.resourceType + ':' + resource.trackingId + ':' + sourceUrl);
      var image    = document.createElement('img');
      image.width  = '1';
      image.height = '1';
      image.src    = pingUrl + '?key=' + key;
      image.alt    = 'Analytics pixel for DocumentCloud';
      document.querySelector('body').appendChild(image);
    }
  };

})();
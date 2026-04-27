var categoryGrid = fragmentElement.querySelector('#forumsCategoryGrid');

if (categoryGrid) {
	var portalURL = Liferay.ThemeDisplay.getPortalURL();
	var scopeGroupId = Liferay.ThemeDisplay.getScopeGroupId();
	var headers = {
		'Accept': 'application/json',
		'Content-Type': 'application/json'
	};

	var gridContainer = categoryGrid.querySelector('#forumsCategoryGridItems');
	var loadingEl = categoryGrid.querySelector('#forumsCategoryGridLoading');

	var categoryIcon = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">
		<path d="M14 1H2c-.6 0-1 .4-1 1v12c0 .6.4 1 1 1h12c.6 0 1-.4 1-1V2c0-.6-.4-1-1-1zm-1 12H3V3h10v10z"/>
		<path d="M5 5h6v1H5zM5 7h6v1H5zM5 9h4v1H5z"/>
	</svg>`;

	Liferay.Util.fetch(portalURL + '/o/c/forumcategories/scopes/' + scopeGroupId + '?pageSize=12&sort=categoryName:asc', {
		headers: headers,
		method: 'GET'
	})
	.then(function(response) { return response.json(); })
	.then(function(data) {
		if (loadingEl) loadingEl.remove();

		var items = data.items || [];

		if (items.length === 0) {
			gridContainer.innerHTML = `<div class="col-12 forums-category-grid__empty">${categoryGrid.dataset.labelNoCategories || 'No categories found.'}</div>`;
			return;
		}

		var pathFriendlyURLPublic = Liferay.ThemeDisplay.getPathFriendlyURLPublic();
		var sitePrefix = '';
		if (pathFriendlyURLPublic) {
			var pubPath = pathFriendlyURLPublic + '/';
			if (window.location.pathname.indexOf(pubPath) === 0) {
				var rest = window.location.pathname.substring(pubPath.length);
				var slugEnd = rest.indexOf('/');
				var siteSlug = slugEnd === -1 ? rest : rest.substring(0, slugEnd);
				sitePrefix = pathFriendlyURLPublic + '/' + siteSlug;
			}
		}
		var baseHref = sitePrefix + ((typeof configuration !== 'undefined' && configuration.threadsURL) ? configuration.threadsURL : '/forum-threads');

		gridContainer.innerHTML = items.map(function(cat) {
			var name = cat.categoryName || categoryGrid.dataset.labelUnnamedCategory || 'Unnamed Category';
			var desc = cat.categoryDescription || '';
			var catId = cat.id || '';

			return `<div class="col-sm-6 col-md-4 col-lg-3 col-xl-2">
				<a href="${baseHref}?categoryId=${catId}" class="forums-category-grid__card">
					<div class="forums-category-grid__card-icon">${categoryIcon}</div>
					<div class="forums-category-grid__card-name">${Liferay.Util.escapeHTML(name)}</div>
					<div class="forums-category-grid__card-desc">${Liferay.Util.escapeHTML(desc)}</div>
					<span class="forums-category-grid__card-arrow">&rsaquo;</span>
				</a>
			</div>`;
		}).join('');
	})
	.catch(function(err) {
		if (loadingEl) loadingEl.remove();
		gridContainer.innerHTML = `<div class="col-12 forums-category-grid__empty">${categoryGrid.dataset.labelUnableToLoad || 'Unable to load categories.'}</div>`;
		console.error('ForumsCategoryGrid error:', err);
	});
}

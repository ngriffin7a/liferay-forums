var forumsHero = fragmentElement.querySelector('#forumsHero');

if (forumsHero) {
	var scopeGroupId = Liferay.ThemeDisplay.getScopeGroupId();
	var portalURL = Liferay.ThemeDisplay.getPortalURL();
	var headers = {
		'Accept': 'application/json',
		'Content-Type': 'application/json'
	};

	function formatCount(n) {
		if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
		if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
		return String(n);
	}

	/* Fetch thread count (ForumThread total) */

	Liferay.Util.fetch(portalURL + '/o/c/forumthreads/scopes/' + scopeGroupId + '?pageSize=1&page=1', {
		headers: headers,
		method: 'GET'
	})
	.then(function(response) { return response.json(); })
	.then(function(data) {
		var el = forumsHero.querySelector('#forumsHeroStatThreads');
		if (el) {
			el.classList.remove('is-loading');
			el.removeAttribute('aria-busy');
			el.textContent = data.totalCount !== undefined ? formatCount(data.totalCount) : '—';
		}
		var cta = forumsHero.querySelector('#forumsHeroCta');
		if (cta) {
			if (data.actions && (data.actions['post'] || data.actions['create'])) {
				cta.style.display = '';
			} else {
				cta.style.display = 'none';
			}
		}
	})
	.catch(function() {
		var el = forumsHero.querySelector('#forumsHeroStatThreads');
		if (el) { el.classList.remove('is-loading'); el.removeAttribute('aria-busy'); el.textContent = '—'; }
	});

	/* Fetch solutions count (ForumReplies where answer=true) */

	Liferay.Util.fetch(portalURL + '/o/c/forumreplies/scopes/' + scopeGroupId + '?pageSize=1&page=1&filter=' + encodeURIComponent("answer eq true"), {
		headers: headers,
		method: 'GET'
	})
	.then(function(response) { return response.json(); })
	.then(function(data) {
		var el = forumsHero.querySelector('#forumsHeroStatSolutions');
		if (el) {
			el.classList.remove('is-loading');
			el.removeAttribute('aria-busy');
			el.textContent = data.totalCount !== undefined ? formatCount(data.totalCount) : '—';
		}
	})
	.catch(function() {
		var el = forumsHero.querySelector('#forumsHeroStatSolutions');
		if (el) { el.classList.remove('is-loading'); el.removeAttribute('aria-busy'); el.textContent = '—'; }
	});

	/* Fetch member count (ForumStatsUser total) */

	Liferay.Util.fetch(portalURL + '/o/c/forumstatsusers/scopes/' + scopeGroupId + '?pageSize=1&page=1', {
		headers: headers,
		method: 'GET'
	})
	.then(function(response) { return response.json(); })
	.then(function(data) {
		var el = forumsHero.querySelector('#forumsHeroStatMembers');
		if (el) {
			el.classList.remove('is-loading');
			el.removeAttribute('aria-busy');
			el.textContent = data.totalCount !== undefined ? formatCount(data.totalCount) : '—';
		}
	})
	.catch(function() {
		var el = forumsHero.querySelector('#forumsHeroStatMembers');
		if (el) { el.classList.remove('is-loading'); el.removeAttribute('aria-busy'); el.textContent = '—'; }
	});
}

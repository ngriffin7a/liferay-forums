// SPDX-License-Identifier: LGPL-2.1-or-later
var panel = fragmentElement.querySelector('#forumsStatisticsPanel');

if (panel) {
	var portalURL = Liferay.ThemeDisplay.getPortalURL();
	var scopeGroupId = Liferay.ThemeDisplay.getScopeGroupId();
	var headers = {
		'Accept': 'application/json',
		'Content-Type': 'application/json'
	};

	/* Leaderboard page size is configurable; default 10. */
	var pageSize = parseInt((typeof configuration !== 'undefined' && configuration.leaderboardPageSize) || '10', 10) || 10;
	var currentPage = 1;

	var leaderboard = panel.querySelector('#forumsStatisticsPanelLeaderboard');
	var paginationNav = panel.querySelector('#forumsStatisticsPanelPagination');
	var paginationUl = panel.querySelector('#forumsStatisticsPanelPaginationUl');

	/* Rank ladder cached after first fetch, sorted descending by minPosts. */
	var rankLadder = null;

	function displayName(creator) {
		if (!creator) return '';
		var given = creator.givenName || '';
		var family = creator.familyName || '';
		return (family && family !== 'User') ? (given + ' ' + family) : (given || creator.name || '');
	}

	function avatarInitial(name) {
		return (name || '?').trim().charAt(0).toUpperCase() || '?';
	}

	/* Stable avatar color from the Clay sticker-outline-0..9 palette. */
	function avatarColorClass(creator) {
		var key = String((creator && (creator.id || creator.name)) || '');
		var sum = 0;
		for (var i = 0; i < key.length; i++) sum += key.charCodeAt(i);
		return 'sticker-outline-' + (sum % 10);
	}

	function renderAvatar(creator) {
		var name = displayName(creator);
		if (creator && creator.image) {
			return '<span class="sticker sticker-circle sticker-sm"><span class="sticker-overlay"><img class="sticker-img" src="' + Liferay.Util.escapeHTML(creator.image) + '" alt="' + Liferay.Util.escapeHTML(name) + '"></span></span>';
		}
		return '<span class="sticker sticker-circle sticker-sm ' + avatarColorClass(creator) + '"><span class="sticker-overlay">' + Liferay.Util.escapeHTML(avatarInitial(name)) + '</span></span>';
	}

	function ensureRankLadder(callback) {
		if (rankLadder) { callback(); return; }
		Liferay.Util.fetch(portalURL + '/o/c/forumranks/scopes/' + scopeGroupId + '?pageSize=100&sort=minPosts:desc', {
			headers: headers,
			method: 'GET'
		})
		.then(function(r) { return r.json(); })
		.then(function(data) {
			var items = (data && data.items) || [];
			rankLadder = items.map(function(it) {
				return { minPosts: it.minPosts || 0, label: it.label || '' };
			});
			rankLadder.sort(function(a, b) { return b.minPosts - a.minPosts; });
			callback();
		})
		.catch(function() { rankLadder = []; callback(); });
	}

	function rankLabel(count) {
		if (!rankLadder) return '';
		for (var i = 0; i < rankLadder.length; i++) {
			if (count >= rankLadder[i].minPosts) return rankLadder[i].label;
		}
		return '';
	}

	function postsText(count) {
		var tmpl = count === 1
			? (panel.dataset.labelXPost || '{0} post')
			: (panel.dataset.labelXPosts || '{0} posts');
		return tmpl.replace('{0}', count);
	}

	function loadLeaderboard() {
		ensureRankLadder(function() {
			Liferay.Util.fetch(portalURL + '/o/c/forumstatsusers/scopes/' + scopeGroupId
				+ '?sort=messageCount:desc&page=' + currentPage + '&pageSize=' + pageSize, {
				headers: headers,
				method: 'GET'
			})
			.then(function(r) { return r.json(); })
			.then(function(data) {
				var items = (data && data.items) || [];
				var lastPage = data.lastPage || 1;

				if (items.length === 0) {
					leaderboard.innerHTML = '<li class="forums-statistics-panel__empty text-secondary text-center py-3">'
						+ (panel.dataset.labelNoPosters || 'No top posters yet.') + '</li>';
					if (paginationNav) paginationNav.style.display = 'none';
					return;
				}

				/* 1-based position continues across pages. */
				var startPosition = (currentPage - 1) * pageSize;
				var html = '';
				items.forEach(function(stats, idx) {
					var creator = stats.creator || {};
					var name = displayName(creator) || (panel.dataset.labelUnknown || 'Unknown');
					var count = stats.messageCount || 0;
					var rank = rankLabel(count);
					html += '<li class="forums-statistics-panel__row">'
						+ '<span class="forums-statistics-panel__position text-secondary">' + (startPosition + idx + 1) + '</span>'
						+ renderAvatar(creator)
						+ '<span class="forums-statistics-panel__poster">'
						+ '<span class="forums-statistics-panel__poster-name text-dark font-weight-semi-bold d-block">' + Liferay.Util.escapeHTML(name) + '</span>'
						+ (rank ? '<span class="forums-statistics-panel__poster-rank text-secondary small d-block">' + Liferay.Util.escapeHTML(rank) + '</span>' : '')
						+ '</span>'
						+ '<span class="forums-statistics-panel__poster-count text-secondary small">' + postsText(count) + '</span>'
						+ '</li>';
				});
				leaderboard.innerHTML = html;

				renderPagination(lastPage);
			})
			.catch(function(err) {
				leaderboard.innerHTML = '<li class="forums-statistics-panel__empty text-secondary text-center py-3">'
					+ (panel.dataset.labelUnableToLoad || 'Unable to load statistics.') + '</li>';
				if (paginationNav) paginationNav.style.display = 'none';
				console.error('ForumsStatisticsPanel error:', err);
			});
		});
	}

	function renderPagination(lastPage) {
		if (!(lastPage > 1 && paginationNav && paginationUl)) {
			if (paginationNav) paginationNav.style.display = 'none';
			return;
		}
		paginationNav.style.display = '';
		var pagHtml = '';

		pagHtml += '<li class="page-item' + (currentPage <= 1 ? ' disabled' : '') + '">'
			+ '<a class="page-link" href="#" data-page="' + (currentPage - 1) + '">&laquo;</a></li>';

		var delta = 2;
		var pageNumbers = [1];
		var rangeStart = Math.max(2, currentPage - delta);
		var rangeEnd = Math.min(lastPage - 1, currentPage + delta);

		if (rangeStart > 2) pageNumbers.push('ellipsis');
		for (var p = rangeStart; p <= rangeEnd; p++) pageNumbers.push(p);
		if (rangeEnd < lastPage - 1) pageNumbers.push('ellipsis');
		pageNumbers.push(lastPage);

		pageNumbers.forEach(function(p) {
			if (p === 'ellipsis') {
				pagHtml += '<li class="page-item disabled"><span class="page-link">&hellip;</span></li>';
			} else {
				pagHtml += '<li class="page-item' + (p === currentPage ? ' active' : '') + '">'
					+ '<a class="page-link" href="#" data-page="' + p + '">' + p + '</a></li>';
			}
		});

		pagHtml += '<li class="page-item' + (currentPage >= lastPage ? ' disabled' : '') + '">'
			+ '<a class="page-link" href="#" data-page="' + (currentPage + 1) + '">&raquo;</a></li>';

		paginationUl.innerHTML = pagHtml;

		paginationUl.querySelectorAll('.page-link').forEach(function(link) {
			link.addEventListener('click', function(e) {
				e.preventDefault();
				var p = parseInt(this.getAttribute('data-page'), 10);
				if (p >= 1 && p <= lastPage && p !== currentPage) {
					currentPage = p;
					loadLeaderboard();
					panel.scrollIntoView({ behavior: 'smooth' });
				}
			});
		});
	}

	loadLeaderboard();
}

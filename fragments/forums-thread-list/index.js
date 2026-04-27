var threadList = fragmentElement.querySelector('#forumsThreadList');

if (threadList) {
	var portalURL = Liferay.ThemeDisplay.getPortalURL();
	var scopeGroupId = Liferay.ThemeDisplay.getScopeGroupId();
	var headers = {
		'Accept': 'application/json',
		'Content-Type': 'application/json'
	};
	var clayIconsUrl = Liferay.ThemeDisplay.getPathThemeImages() + '/clay/icons.svg';

	/* State */
	var currentSort = 'dateCreated:desc';
	var currentPage = 1;
	var pageSize = 20;
	var categoryId = null;
	var searchQuery = '';
	var currentUserId = Liferay.ThemeDisplay.getUserId();
	var isBanned = false;

	/* DOM refs */
	var cardsContainer = threadList.querySelector('#forumsThreadListCards');
	var loadingEl = threadList.querySelector('#forumsThreadListLoading');
	var paginationNav = threadList.querySelector('#forumsThreadListPagination');
	var paginationUl = threadList.querySelector('#forumsThreadListPaginationUl');
	var headingEl = threadList.querySelector('#forumsThreadListHeading');
	var breadcrumbName = threadList.querySelector('#forumsThreadListCategoryName');
	var searchInput = threadList.querySelector('#forumsThreadListSearchInput');
	var searchBtn = threadList.querySelector('#forumsThreadListSearchBtn');
	var tabLinks = threadList.querySelectorAll('#forumsThreadListTabs .nav-link');
	var askBtn = threadList.querySelector('#forumsThreadListAskBtn');
	var categoryFilter = threadList.querySelector('#forumsThreadListCategoryFilter');
	var showingEl = threadList.querySelector('#forumsThreadListShowing');

	/* Read URL params */
	var urlParams = new URLSearchParams(window.location.search);
	categoryId = urlParams.get('categoryId');
	searchQuery = urlParams.get('q') || '';
	if (searchInput && searchQuery) searchInput.value = searchQuery;

	/* Icons */
	var checkIcon = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm3.7 6.3l-4 4c-.2.2-.4.3-.7.3s-.5-.1-.7-.3l-2-2c-.4-.4-.4-1 0-1.4s1-.4 1.4 0L7 8.2l3.3-3.3c.4-.4 1-.4 1.4 0s.4 1 0 1.4z"/></svg>';
	var replyIcon = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M14 1H2C.9 1 0 1.9 0 3v7c0 1.1.9 2 2 2h3l3 3 3-3h3c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 9H2V3h12v7z"/></svg>';
	var clockIcon = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 14c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z"/><path d="M9 4H7v5l3.5 2.1.5-.9L9 8.5z"/></svg>';
	var eyeIcon = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 3C3.58 3 0 8 0 8s3.58 5 8 5 8-5 8-5-3.58-5-8-5zm0 8.5c-1.93 0-3.5-1.57-3.5-3.5S6.07 4.5 8 4.5 11.5 6.07 11.5 8 9.93 11.5 8 11.5z"/><circle cx="8" cy="8" r="2"/></svg>';

	/* Utility: relative time */
	function timeAgo(dateStr) {
		if (!dateStr) return '';
		var now = Date.now();
		var then = new Date(dateStr).getTime();
		var diff = Math.floor((now - then) / 1000);
		if (diff < 60) return threadList.dataset.labelJustNow || 'just now';
		if (diff < 3600) return (threadList.dataset.labelXMinutesAgo || '{0}m ago').replace('{0}', Math.floor(diff / 60));
		if (diff < 86400) return (threadList.dataset.labelXHoursAgo || '{0}h ago').replace('{0}', Math.floor(diff / 3600));
		if (diff < 2592000) return (threadList.dataset.labelXDaysAgo || '{0}d ago').replace('{0}', Math.floor(diff / 86400));
		return new Date(dateStr).toLocaleDateString();
	}

	/* Utility: avatar initial */
	function avatarInitial(name) {
		if (!name) return '?';
		return name.charAt(0).toUpperCase();
	}

	function displayName(creator) {
		if (!creator) return '';
		var given = creator.givenName || '';
		var family = creator.familyName || '';
		return (family && family !== 'User') ? (given + ' ' + family) : (given || creator.name || '');
	}

	/* Fetch category name for breadcrumb */
	if (categoryId) {
		Liferay.Util.fetch(portalURL + '/o/c/forumcategories/' + categoryId, {
			headers: headers,
			method: 'GET'
		})
		.then(function(r) { return r.json(); })
		.then(function(cat) {
			var name = cat.categoryName || threadList.dataset.labelCategory || 'Category';
			if (headingEl) headingEl.textContent = name;
			if (breadcrumbName) breadcrumbName.textContent = name;
		})
		.catch(function() {});
	}

	/* Populate category filter dropdown */
	if (categoryFilter) {
		Liferay.Util.fetch(portalURL + '/o/c/forumcategories/scopes/' + scopeGroupId + '?pageSize=200&sort=categoryName:asc', {
			headers: headers,
			method: 'GET'
		})
		.then(function(r) { return r.json(); })
		.then(function(data) {
			(data.items || []).forEach(function(cat) {
				var opt = document.createElement('option');
				opt.value = cat.id;
				opt.textContent = cat.categoryName || '';
				if (String(cat.id) === String(categoryId)) {
					opt.selected = true;
				}
				categoryFilter.appendChild(opt);
			});
		})
		.catch(function() {});

		categoryFilter.addEventListener('change', function() {
			categoryId = this.value || null;
			currentPage = 1;

			var params = new URLSearchParams(window.location.search);
			if (categoryId) {
				params.set('categoryId', categoryId);
			}
			else {
				params.delete('categoryId');
			}
			history.pushState(null, '', window.location.pathname + (params.toString() ? '?' + params.toString() : ''));

			var allLabel = threadList.dataset.labelAllCategories || threadList.dataset.labelAllThreads || 'All Threads';
			if (!categoryId) {
				if (headingEl) headingEl.textContent = allLabel;
				if (breadcrumbName) breadcrumbName.textContent = allLabel;
			}
			else {
				var selectedOpt = this.options[this.selectedIndex];
				var catName = selectedOpt ? selectedOpt.textContent : allLabel;
				if (headingEl) headingEl.textContent = catName;
				if (breadcrumbName) breadcrumbName.textContent = catName;
			}

			loadThreads();
		});
	}

	/* Load threads */
	function loadThreads() {
		if (loadingEl) {
			loadingEl.style.display = '';
		}
		cardsContainer.querySelectorAll('.forums-thread-card').forEach(function(el) { el.remove(); });
		if (paginationNav) paginationNav.style.display = 'none';
		if (showingEl) showingEl.style.display = 'none';

		var filterParts = [];
		if (categoryId) {
			filterParts.push('r_categoryThreads_c_forumCategoryId eq \'' + categoryId + '\'');
		}

		var url = portalURL + '/o/c/forumthreads/scopes/' + scopeGroupId + '?page=' + currentPage
			+ '&pageSize=' + pageSize
			+ '&sort=' + currentSort;

		if (filterParts.length > 0) {
			url += '&filter=' + encodeURIComponent(filterParts.join(' and '));
		}

		if (searchQuery) {
			url += '&search=' + encodeURIComponent(searchQuery);
		}

		Liferay.Util.fetch(url, { headers: headers, method: 'GET' })
		.then(function(r) { return r.json(); })
		.then(function(data) {
			if (loadingEl) loadingEl.style.display = 'none';

			if (askBtn) {
				if (!isBanned && data.actions && (data.actions['post'] || data.actions['create'])) {
					askBtn.style.display = '';
				} else {
					askBtn.style.display = 'none';
				}
			}

			var items = data.items || [];
			var totalCount = data.totalCount || 0;
			var lastPage = data.lastPage || 1;

			if (items.length === 0) {
				cardsContainer.innerHTML = '<div class="forums-thread-list__empty">' + (threadList.dataset.labelNoThreads || 'No threads found.') + '</div>';
				return;
			}

			/* Fetch replies and activities separately to avoid JOIN-based pagination overlap */
			var threadIds = items.map(function(t) { return t.id; });
			var repliesFilter = threadIds.map(function(id) {
				return 'r_threadReplies_c_forumThreadId eq \'' + id + '\'';
			}).join(' or ');
			var activitiesFilter = threadIds.map(function(id) {
				return 'r_threadSuspiciousActivities_c_forumThreadId eq \'' + id + '\'';
			}).join(' or ');

			return Promise.all([
				Liferay.Util.fetch(
					portalURL + '/o/c/forumreplies/scopes/' + scopeGroupId
						+ '?filter=' + encodeURIComponent(repliesFilter)
						+ '&pageSize=500&sort=dateCreated:asc',
					{ headers: headers, method: 'GET' }
				).then(function(r) { return r.json(); }).catch(function() { return { items: [] }; }),
				Liferay.Util.fetch(
					portalURL + '/o/c/forumsuspiciousactivities/scopes/' + scopeGroupId
						+ '?filter=' + encodeURIComponent(activitiesFilter)
						+ '&pageSize=500',
					{ headers: headers, method: 'GET' }
				).then(function(r) { return r.json(); }).catch(function() { return { items: [] }; })
			]).then(function(results) {
				var repliesByThread = {};
				(results[0].items || []).forEach(function(reply) {
					var tid = reply.r_threadReplies_c_forumThreadId;
					if (!repliesByThread[tid]) repliesByThread[tid] = [];
					repliesByThread[tid].push(reply);
				});
				var activitiesByThread = {};
				(results[1].items || []).forEach(function(activity) {
					var tid = activity.r_threadSuspiciousActivities_c_forumThreadId;
					if (!activitiesByThread[tid]) activitiesByThread[tid] = [];
					activitiesByThread[tid].push(activity);
				});
				items.forEach(function(thread) {
					thread.threadReplies = repliesByThread[thread.id] || [];
					thread.threadSuspiciousActivities = activitiesByThread[thread.id] || [];
				});

			var html = '';
			var missingDisplayPage = false;
			items.forEach(function(thread) {
				if (isBanned && thread.actions) {
					thread.actions = {};
				}
				var title = thread.threadTitle || threadList.dataset.labelUntitledThread || 'Untitled Thread';
				var threadId = thread.id || '';
				var creatorName = displayName(thread.creator) || threadList.dataset.labelUnknown || 'Unknown';
				var creatorImage = (thread.creator && thread.creator.image) || '';
				var dateStr = thread.dateCreated || '';
				var messages = thread.threadReplies || [];
				var replyCount = messages.length > 0 ? messages.length - 1 : 0;
				var hasSolution = false;

				for (var i = 0; i < messages.length; i++) {
					if (messages[i].answer === true) {
						hasSolution = true;
						break;
					}
				}

				var isFlagged = false;
				var suspiciousActivities = thread.threadSuspiciousActivities || [];
				for (var s = 0; s < suspiciousActivities.length; s++) {
					if (suspiciousActivities[s].validated === true) {
						isFlagged = true;
						break;
					}
				}

				/* Get first message body as preview */
				var preview = '';
				if (messages.length > 0 && messages[0].body) {
					var tmp = document.createElement('div');
					tmp.innerHTML = messages[0].body;
					preview = tmp.textContent || tmp.innerText || '';
					if (preview.length > 160) preview = preview.substring(0, 160) + '...';
				}

				/* Avatar */
				var avatarHtml;
				if (creatorImage) {
					avatarHtml = '<div class="forums-thread-card__avatar"><img src="' + Liferay.Util.escapeHTML(creatorImage) + '" alt="' + Liferay.Util.escapeHTML(creatorName) + '"></div>';
				} else {
					avatarHtml = '<div class="forums-thread-card__avatar">' + avatarInitial(creatorName) + '</div>';
				}

				/* Solved badge */
				var solvedBadge = '';
				if (thread.question && hasSolution) {
					var solvedText = threadList.dataset.labelSolved || 'Solved';
					solvedBadge = '<span class="forums-thread-card__solved">' + checkIcon + ' ' + solvedText + '</span>';
				}

				var siteSlug = (thread.scopeKey || '').toLowerCase().replace(/ /g, '-');
				var topicHref = thread.friendlyUrlPath
					? Liferay.ThemeDisplay.getPathFriendlyURLPublic() + '/' + siteSlug + '/-c-forum-topic-/' + thread.friendlyUrlPath
					: null;
				if (!topicHref) missingDisplayPage = true;

				var flaggedBadge = '';
				if (isFlagged) {
					var flaggedText = threadList.dataset.labelFlagged || 'Flagged';
					flaggedBadge = '<span class="forums-thread-card__solved text-danger ml-2"><svg class="lexicon-icon lexicon-icon-warning-full" role="presentation" viewBox="0 0 16 16" fill="currentColor"><path d="M16 14.5L8 1 0 14.5h16zM8 13c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm1-3H7V6h2v4z"/></svg> ' + flaggedText + '</span>';
				}

				html += '<div class="forums-thread-card">'
					+ '<div class="forums-thread-card__inner">'
					+ '<div class="forums-thread-card__avatar-col">'
					+ avatarHtml
					+ '<span class="forums-thread-card__username">' + Liferay.Util.escapeHTML(creatorName) + '</span>'
					+ '</div>'
					+ '<div class="forums-thread-card__content">'
					+ '<h5 class="forums-thread-card__title">'
					+ (topicHref ? '<a href="' + topicHref + '">' + Liferay.Util.escapeHTML(title) + '</a>' : '<span>' + Liferay.Util.escapeHTML(title) + '</span>')
					+ solvedBadge
					+ flaggedBadge
					+ '</h5>'
					+ '<p class="forums-thread-card__preview">' + Liferay.Util.escapeHTML(preview) + '</p>'
					+ (function() {
						var threadTags = thread.keywords || [];
						if (threadTags.length === 0) return '';
						var tHtml = '<div class="forums-thread-card__tags">';
						threadTags.forEach(function(tag) {
							tHtml += '<span class="label label-secondary forums-thread-card__tag"><span class="label-item label-item-expand">' + Liferay.Util.escapeHTML(tag) + '</span></span>';
						});
						tHtml += '</div>';
						return tHtml;
					})()
					+ '<div class="forums-thread-card__meta">'
					+ '<span class="forums-thread-card__meta-item">' + clockIcon + ' ' + timeAgo(dateStr) + '</span>'
					+ '<span class="forums-thread-card__meta-item">' + replyIcon + ' ' + (replyCount === 1 ? (threadList.dataset.labelXReply || '{0} reply').replace('{0}', replyCount) : (threadList.dataset.labelXReplies || '{0} replies').replace('{0}', replyCount)) + '</span>'
					+ '<span class="forums-thread-card__meta-item">' + eyeIcon + ' ' + (thread.viewCount || 0) + '</span>'
					+ (thread.actions && thread.actions['delete']
						? '<span class="forums-thread-card__meta-item ml-auto ms-auto"><button class="btn btn-danger btn-sm forums-list-delete-btn" data-delete-url="' + thread.actions['delete'].href + '" title="' + (threadList.dataset.labelDelete || 'Delete') + '" aria-label="' + (threadList.dataset.labelDelete || 'Delete') + '"><svg class="lexicon-icon lexicon-icon-trash" role="presentation"><use href="' + clayIconsUrl + '#trash"></use></svg></button></span>'
						: '')
					+ '</div>'
					+ '</div>'
					+ '</div>'
					+ '</div>';
			});

			cardsContainer.innerHTML = html;
			attachDeleteHandlers();

			if (missingDisplayPage && Liferay.Util && Liferay.Util.openToast) {
				Liferay.Util.openToast({
					message: threadList.dataset.labelDisplayPageNotConfigured || 'Display page is not configured for one or more threads.',
					type: 'danger'
				});
			}

			/* Showing x-y of total */
			if (showingEl && totalCount > 0) {
				var startItem = (currentPage - 1) * pageSize + 1;
				var endItem = Math.min(currentPage * pageSize, totalCount);
				var showingLabel = (threadList.dataset.labelShowing || 'Showing {0} of {1} Items')
					.replace('{0}', startItem + '-' + endItem).replace('{1}', totalCount);
				showingEl.textContent = showingLabel;
				showingEl.style.display = '';
			}

			/* Pagination */
			if (lastPage > 1 && paginationNav && paginationUl) {
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
						var p = parseInt(this.getAttribute('data-page'));
						if (p >= 1 && p <= lastPage) {
							currentPage = p;
							loadThreads();
							threadList.scrollIntoView({ behavior: 'smooth' });
						}
					});
				});
			}
			}); /* close Promise.all().then() */
		})
		.catch(function(err) {
			if (loadingEl) loadingEl.style.display = 'none';
			cardsContainer.innerHTML = '<div class="forums-thread-list__empty">' + (threadList.dataset.labelUnableToLoad || 'Unable to load threads.') + '</div>';
			console.error('ForumsThreadList error:', err);
		});
	}

	/* Delete Modal Setup */
	var deleteModalObj = null;

	function showDeleteModal(title, message, onConfirm) {
		var modal = document.getElementById('forumsDeleteModal');
		if (!modal) {
			modal = document.createElement('div');
			modal.id = 'forumsDeleteModal';
			modal.className = 'modal';
			modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
			modal.style.zIndex = '1050';
			modal.setAttribute('tabindex', '-1');
			modal.setAttribute('role', 'dialog');
			modal.setAttribute('aria-modal', 'true');
			modal.setAttribute('aria-labelledby', 'forumsDeleteModalHeading');

			modal.innerHTML = '<div class="modal-dialog modal-dialog-sm modal-dialog-centered modal-danger">' +
				'<div class="modal-content">' +
				'<div class="modal-header">' +
				'<h1 class="modal-title" tabindex="-1">' +
				'<div class="modal-title-indicator">' +
				'<svg class="lexicon-icon lexicon-icon-exclamation-full" role="presentation">' +
				'<use href="' + clayIconsUrl + '#exclamation-full"></use>' +
				'</svg>' +
				'</div>' +
				'<span id="forumsDeleteModalHeading"></span>' +
				'</h1>' +
				'<button class="close btn btn-unstyled forums-delete-modal-close" type="button" aria-label="Close">' +
				'<svg class="lexicon-icon lexicon-icon-times" role="presentation">' +
				'<use href="' + clayIconsUrl + '#times"></use>' +
				'</svg>' +
				'</button>' +
				'</div>' +
				'<div class="modal-body">' +
				'<div class="liferay-modal-body" id="forumsDeleteModalBody"></div>' +
				'</div>' +
				'<div class="modal-footer">' +
				'<div class="modal-item-last">' +
				'<div class="btn-group-spaced" role="group">' +
				'<button class="btn btn-secondary forums-delete-modal-close" type="button">' + (threadList.dataset.labelCancel || 'Cancel') + '</button>' +
				'<button class="btn btn-danger" type="button" id="forumsDeleteModalConfirmBtn">' + (threadList.dataset.labelDelete || 'Delete') + '</button>' +
				'</div>' +
				'</div>' +
				'</div>' +
				'</div>' +
				'</div>';
			document.body.appendChild(modal);

			modal.querySelectorAll('.forums-delete-modal-close').forEach(function(btn) {
				btn.addEventListener('click', function() {
					modal.style.display = 'none';
					modal.classList.remove('show');
					if (deleteModalObj && deleteModalObj.onCancel) {
						deleteModalObj.onCancel();
					}
				});
			});

			modal.querySelector('#forumsDeleteModalConfirmBtn').addEventListener('click', function() {
				modal.style.display = 'none';
				modal.classList.remove('show');
				if (deleteModalObj && deleteModalObj.onConfirm) {
					deleteModalObj.onConfirm();
				}
			});
		}

		modal.querySelector('#forumsDeleteModalHeading').textContent = title;
		modal.querySelector('#forumsDeleteModalBody').textContent = message;
		
		deleteModalObj = {
			onConfirm: onConfirm,
			onCancel: null
		};

		modal.style.display = 'block';
		setTimeout(function() {
			modal.classList.add('show');
		}, 10);
	}

	function attachDeleteHandlers() {
		threadList.querySelectorAll('.forums-list-delete-btn').forEach(function(btn) {
			btn.addEventListener('click', function(e) {
				e.preventDefault();
				e.stopPropagation();
				
				var title = threadList.dataset.labelDeleteTopic || 'Delete Topic';
				var confirmMsg = threadList.dataset.labelConfirmDeleteTopic || 'Deleting a topic is an action impossible to revert. All the replies in the topic will be removed and it will not be possible to recover them.';
				
				var deleteUrl = this.getAttribute('data-delete-url');
				var card = this.closest('.forums-thread-card');

				showDeleteModal(title, confirmMsg, function() {
					Liferay.Util.fetch(deleteUrl, {
						headers: headers,
						method: 'DELETE'
					})
					.then(function(r) {
						if (r.ok) {
							if (card) {
								card.style.opacity = '0.5';
								setTimeout(function() { card.remove(); }, 300);
							}
							setTimeout(loadThreads, 1500);
						} else {
							console.error('Failed to delete topic');
						}
					})
					.catch(function(err) { console.error('Delete topic error:', err); });
				});
			});
		});
	}

	/* Tab click handlers */
	tabLinks.forEach(function(tab) {
		tab.addEventListener('click', function(e) {
			e.preventDefault();
			tabLinks.forEach(function(t) {
				t.classList.remove('active');
				t.setAttribute('aria-selected', 'false');
			});
			this.classList.add('active');
			this.setAttribute('aria-selected', 'true');
			currentSort = this.getAttribute('data-sort');
			currentPage = 1;
			loadThreads();
		});
	});

	/* Search handler */
	function doSearch() {
		searchQuery = searchInput ? searchInput.value.trim() : '';
		currentPage = 1;
		loadThreads();
	}

	if (searchBtn) {
		searchBtn.addEventListener('click', doSearch);
	}

	if (searchInput) {
		searchInput.addEventListener('keypress', function(e) {
			if (e.key === 'Enter') {
				e.preventDefault();
				doSearch();
			}
		});
	}

	/* Initial load */
	if (Liferay.ThemeDisplay.isSignedIn()) {
		Liferay.Util.fetch(portalURL + '/o/c/forumbans/scopes/' + scopeGroupId + '?filter=' + encodeURIComponent('banUserId eq ' + currentUserId) + '&pageSize=1', {
			headers: headers,
			method: 'GET'
		})
		.then(function(r) { return r.json(); })
		.then(function(data) {
			if (data.items && data.items.length > 0) {
				isBanned = true;
			}
			loadThreads();
		})
		.catch(function(err) {
			console.error('Error checking ban status', err);
			loadThreads();
		});
	} else {
		loadThreads();
	}
}

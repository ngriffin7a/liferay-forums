var forumsMod = fragmentElement.querySelector('#forumsModeration');

if (forumsMod) {
	var portalURL = Liferay.ThemeDisplay.getPortalURL();
	var scopeGroupId = Liferay.ThemeDisplay.getScopeGroupId();
	var headers = {
		'Accept': 'application/json',
		'Content-Type': 'application/json'
	};

	function buildThreadHref(threadData) {
		if (threadData && threadData.friendlyUrlPath) {
			var siteSlug = (threadData.scopeKey || '').toLowerCase().replace(/ /g, '-');
			return Liferay.ThemeDisplay.getPathFriendlyURLPublic() + '/' + siteSlug + '/-c-forum-topic-/' + threadData.friendlyUrlPath;
		}
		return null;
	}
	var cardEl = forumsMod.querySelector('.forums-moderation__card');
	var noPermissionsEl = forumsMod.querySelector('#forumsModNoPermissions');
	var loadingEl = forumsMod.querySelector('#forumsModLoading');
	var flagList = forumsMod.querySelector('#forumsModFlagList');
	var paginationNav = forumsMod.querySelector('#forumsModPagination');
	var paginationUl = forumsMod.querySelector('#forumsModPaginationUl');

	var currentFilter = 'pending'; /* 'pending' | 'validated' | 'all' */
	var currentPage = 1;
	var pageSize = 20;

	/* Reason labels map */
	var reasonLabels = {
		'spam': forumsMod.dataset.labelSpam || 'Spam',
		'harmful-dangerous-acts': forumsMod.dataset.labelHarmfulDangerousActs || 'Harmful Dangerous Acts',
		'harassment-bullying': forumsMod.dataset.labelHarassmentBullying || 'Harassment or Bullying',
		'nudity-sexual-content': forumsMod.dataset.labelNuditySexualContent || 'Nudity or Sexual Content',
		'other': forumsMod.dataset.labelOther || 'Other'
	};

	function displayName(creator) {
		if (!creator) return '';
		var given = creator.givenName || '';
		var family = creator.familyName || '';
		return (family && family !== 'User') ? (given + ' ' + family) : (given || creator.name || '');
	}

	function formatDate(dateStr) {
		if (!dateStr) return '';
		var d = new Date(dateStr);
		return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
	}

	function getReasonLabel(reason) {
		return reasonLabels[reason] || reason || forumsMod.dataset.labelOther || 'Other';
	}

	function getReasonBadgeClass(reason) {
		var safe = (reason || 'other').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
		return 'forums-moderation__reason-badge forums-moderation__reason-badge--' + safe;
	}

	function showConfirmModal(message, confirmLabel, onConfirm) {
		var existing = document.getElementById('forumsModConfirmModal');
		if (existing) existing.remove();

		var modal = document.createElement('div');
		modal.id = 'forumsModConfirmModal';
		modal.className = 'modal';
		modal.style.display = 'flex';
		modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
		modal.style.zIndex = '1050';
		modal.setAttribute('tabindex', '-1');
		modal.setAttribute('role', 'dialog');
		modal.setAttribute('aria-modal', 'true');
		modal.setAttribute('aria-labelledby', 'forumsModConfirmHeading');

		modal.innerHTML = `
			<div class="modal-dialog modal-dialog-sm modal-dialog-centered">
				<div class="modal-content">
					<div class="modal-header">
						<h1 class="modal-title" id="forumsModConfirmHeading" tabindex="-1">${Liferay.Util.escapeHTML(message)}</h1>
					</div>
					<div class="modal-footer">
						<div class="btn-group-spaced" role="group">
							<button class="btn btn-secondary" type="button" id="forumsModConfirmCancel">${Liferay.Util.escapeHTML(forumsMod.dataset.labelCancel || 'Cancel')}</button>
							<button class="btn btn-danger" type="button" id="forumsModConfirmOk">${Liferay.Util.escapeHTML(confirmLabel)}</button>
						</div>
					</div>
				</div>
			</div>`;

		document.body.appendChild(modal);
		var previousFocus = document.activeElement;

		function closeModal() {
			modal.remove();
			if (previousFocus) previousFocus.focus();
		}

		modal.querySelector('#forumsModConfirmCancel').addEventListener('click', closeModal);
		modal.querySelector('#forumsModConfirmOk').addEventListener('click', function() {
			closeModal();
			onConfirm();
		});
		modal.addEventListener('keydown', function(e) {
			if (e.key === 'Escape') closeModal();
		});

		modal.querySelector('#forumsModConfirmHeading').focus();
	}

	function showToast(message) {
		var toast = document.createElement('div');
		toast.className = 'forums-moderation-toast';
		toast.textContent = message;
		flagList.parentNode.insertBefore(toast, flagList);
		setTimeout(function() { toast.classList.add('forums-moderation-toast--visible'); }, 10);
		setTimeout(function() {
			toast.classList.remove('forums-moderation-toast--visible');
			setTimeout(function() { toast.remove(); }, 300);
		}, 3000);
	}

	/* Tab click handlers */
	forumsMod.querySelectorAll('#forumsModTabs .nav-link').forEach(function(tab) {
		tab.addEventListener('click', function(e) {
			e.preventDefault();
			forumsMod.querySelectorAll('#forumsModTabs .nav-link').forEach(function(t) {
				t.classList.remove('active');
				t.setAttribute('aria-selected', 'false');
			});
			this.classList.add('active');
			this.setAttribute('aria-selected', 'true');
			if (flagList) flagList.setAttribute('aria-labelledby', this.id);
			currentFilter = this.getAttribute('data-filter');
			currentPage = 1;
			if (currentFilter === 'bans') {
				loadBans();
			} else {
				loadFlags();
			}
		});
	});

	function renderPagination(lastPage, loadFunction) {
		if (lastPage > 1 && paginationNav && paginationUl) {
			paginationNav.style.display = '';
			var pagHtml = '';

			pagHtml += '<li class="page-item' + (currentPage <= 1 ? ' disabled' : '') + '">'
				+ '<a class="page-link" href="#" data-page="' + (currentPage - 1) + '" aria-label="Previous page"><span aria-hidden="true">&laquo;</span></a></li>';

			for (var p = 1; p <= lastPage && p <= 10; p++) {
				pagHtml += '<li class="page-item' + (p === currentPage ? ' active' : '') + '">'
					+ '<a class="page-link" href="#" data-page="' + p + '">' + p + '</a></li>';
			}

			pagHtml += '<li class="page-item' + (currentPage >= lastPage ? ' disabled' : '') + '">'
				+ '<a class="page-link" href="#" data-page="' + (currentPage + 1) + '" aria-label="Next page"><span aria-hidden="true">&raquo;</span></a></li>';

			paginationUl.innerHTML = pagHtml;

			paginationUl.querySelectorAll('.page-link').forEach(function(link) {
				link.addEventListener('click', function(e) {
					e.preventDefault();
					var p = parseInt(this.getAttribute('data-page'));
					if (p >= 1 && p <= lastPage) {
						currentPage = p;
						loadFunction();
					}
				});
			});
		} else if (paginationNav) {
			paginationNav.style.display = 'none';
		}
	}

	function loadBans() {
		if (loadingEl) loadingEl.style.display = 'block';
		flagList.innerHTML = '';
		if (paginationNav) paginationNav.style.display = 'none';

		var url = portalURL + '/o/c/forumbans/scopes/' + scopeGroupId
			+ '?sort=dateCreated:desc'
			+ '&page=' + currentPage
			+ '&pageSize=' + pageSize;

		Liferay.Util.fetch(url, { headers: headers, method: 'GET' })
		.then(function(r) { return r.json(); })
		.then(function(data) {
			if (loadingEl) loadingEl.style.display = 'none';
			var items = data.items || [];
			var lastPage = data.lastPage || 1;

			if (items.length === 0) {
				flagList.innerHTML = '<div class="list-group-item text-muted">' + (forumsMod.dataset.labelNoBans || 'No bans found.') + '</div>';
				return;
			}

			items.forEach(function(ban) {
				var item = document.createElement('div');
				item.className = 'list-group-item forums-moderation__flag-item';
				var infoDiv = document.createElement('div');
				infoDiv.className = 'forums-moderation__flag-info';
				var titleLink = document.createElement('span');
				titleLink.className = 'forums-moderation__thread-title font-weight-bold';
				titleLink.textContent = (forumsMod.dataset.labelUserId || 'User ID: {0}').replace('{0}', ban.banUserId);
				var metaDiv = document.createElement('div');
				metaDiv.className = 'forums-moderation__flag-meta mt-1';
				var dateSpan = document.createElement('span');
				dateSpan.textContent = (forumsMod.dataset.labelBannedOn || 'Banned on: {0}').replace('{0}', formatDate(ban.dateCreated));
				metaDiv.appendChild(dateSpan);
				infoDiv.appendChild(titleLink);
				infoDiv.appendChild(metaDiv);
				var actionsDiv = document.createElement('div');
				actionsDiv.className = 'forums-moderation__flag-actions';
				if (ban.actions && ban.actions['delete']) {
					var revokeBtn = document.createElement('button');
					revokeBtn.className = 'btn btn-sm btn-outline-success';
					revokeBtn.textContent = forumsMod.dataset.labelRevokeBan || 'Revoke Ban';
					revokeBtn.addEventListener('click', function() {
						var message = forumsMod.dataset.labelConfirmRevokeBan || 'Are you sure you want to revoke this ban?';
						showConfirmModal(message, forumsMod.dataset.labelRevokeBan || 'Revoke Ban', function() {
							revokeBtn.disabled = true;
							Liferay.Util.fetch(ban.actions['delete'].href, { headers: headers, method: 'DELETE' }).then(function(r) {
								if (r.ok) { item.style.opacity = '0.5'; setTimeout(function() { item.remove(); showToast(forumsMod.dataset.labelBanRevokedSuccessfully || 'Ban revoked successfully.'); if (flagList.children.length === 0) loadBans(); }, 300); }
							}).catch(function(e) { revokeBtn.disabled = false; console.error(e); });
						});
					});
					actionsDiv.appendChild(revokeBtn);
				}
				item.appendChild(infoDiv);
				item.appendChild(actionsDiv);
				flagList.appendChild(item);
				Liferay.Util.fetch(portalURL + '/o/headless-admin-user/v1.0/user-accounts/' + ban.banUserId, { headers: headers, method: 'GET' }).then(function(r) { return r.json(); }).then(function(u) { var n = displayName(u) || u.name; if (n) { titleLink.textContent = n + ' (ID: ' + ban.banUserId + ')'; } }).catch(function() { });
			});
			renderPagination(lastPage, loadBans);
		}).catch(function(err) { if (loadingEl) loadingEl.style.display = 'none'; console.error('Bans load error:', err); });
	}

	function buildFilterParam() {
		if (currentFilter === 'pending') {
			return '&filter=' + encodeURIComponent("validated eq false");
		} else if (currentFilter === 'validated') {
			return '&filter=' + encodeURIComponent("validated eq true");
		}
		return ''; /* 'all' — no filter */
	}

	function loadFlags() {
		if (loadingEl) loadingEl.style.display = 'block';
		flagList.innerHTML = '';
		if (paginationNav) paginationNav.style.display = 'none';

		var url = portalURL + '/o/c/forumsuspiciousactivities/scopes/' + scopeGroupId
			+ '?nestedFields=threadSuspiciousActivities'
			+ '&sort=dateCreated:desc'
			+ '&page=' + currentPage
			+ '&pageSize=' + pageSize
			+ buildFilterParam();

		Liferay.Util.fetch(url, {
			headers: headers,
			method: 'GET'
		})
		.then(function(r) { return r.json(); })
		.then(function(data) {
			if (loadingEl) loadingEl.style.display = 'none';

			/* HATEOAS: check collection-level actions for write permission */
			var hasPermission = !!(data.actions && (
				data.actions['create'] || data.actions['post'] || data.actions['POST']
			));

			if (hasPermission) {
				/* User has moderation permissions — show the card */
				if (noPermissionsEl) noPermissionsEl.style.display = 'none';
				if (cardEl) cardEl.style.display = '';
			} else {
				/* Non-privileged user — show the OOTB permissions warning */
				if (cardEl) cardEl.style.display = 'none';
				if (noPermissionsEl) noPermissionsEl.style.display = '';
				return;
			}

			var items = data.items || [];
			var totalCount = data.totalCount || 0;
			var lastPage = data.lastPage || 1;

			if (items.length === 0) {
				flagList.innerHTML = '<div class="list-group-item text-muted">' + (forumsMod.dataset.labelNoFlags || 'No flagged threads found.') + '</div>';
				return;
			}

			var missingDisplayPage = false;
			items.forEach(function(flag) {
				var threadData = flag.threadSuspiciousActivities || {};
				var threadTitle = threadData.threadTitle || threadData.title || 'Thread #' + (flag.suspiciousThreadId || flag.r_threadSuspiciousActivities_c_forumThreadId || '?');
				var threadId = flag.suspiciousThreadId || flag.r_threadSuspiciousActivities_c_forumThreadId;
				var authorId = threadData.creator ? threadData.creator.id : null;
				var creator = flag.creator || {};
				var creatorName = displayName(creator) || 'Unknown';
				var reason = flag.reason || 'other';
				var isValidated = flag.validated === true;
				var date = formatDate(flag.dateCreated);

				var item = document.createElement('div');
				item.className = 'list-group-item forums-moderation__flag-item';

				/* Info column */
				var infoDiv = document.createElement('div');
				infoDiv.className = 'forums-moderation__flag-info';

				var titleHref = buildThreadHref(threadData);
				if (!titleHref) missingDisplayPage = true;

				var titleLink = document.createElement('a');
				titleLink.className = 'forums-moderation__thread-title';
				titleLink.textContent = threadTitle;
				if (titleHref) titleLink.href = titleHref;
				titleLink.target = '_blank';
				titleLink.title = forumsMod.dataset.labelViewThread || 'View Thread';

				var metaDiv = document.createElement('div');
				metaDiv.className = 'forums-moderation__flag-meta';

				/* Reporter */
				var reportedByTmpl = forumsMod.dataset.labelReportedBy || 'Reported by {0}';
				var reporterSpan = document.createElement('span');
				reporterSpan.textContent = reportedByTmpl.replace('{0}', creatorName);

				/* Date */
				var dateSpan = document.createElement('span');
				dateSpan.textContent = date;

				/* Reason badge */
				var reasonBadge = document.createElement('span');
				reasonBadge.className = getReasonBadgeClass(reason);
				reasonBadge.textContent = getReasonLabel(reason);

				/* Status badge */
				var statusBadge = document.createElement('span');
				statusBadge.className = 'forums-moderation__status-badge forums-moderation__status-badge--' + (isValidated ? 'validated' : 'pending');
				statusBadge.textContent = isValidated
					? (forumsMod.dataset.labelValidated || 'Validated')
					: (forumsMod.dataset.labelPending || 'Pending');

				metaDiv.appendChild(reporterSpan);
				metaDiv.appendChild(dateSpan);
				metaDiv.appendChild(reasonBadge);
				metaDiv.appendChild(statusBadge);

				infoDiv.appendChild(titleLink);
				infoDiv.appendChild(metaDiv);

				/* Actions column */
				var actionsDiv = document.createElement('div');
				actionsDiv.className = 'forums-moderation__flag-actions';

				/* View link — always shown (read-only) */
				var viewLink = document.createElement('a');
				viewLink.className = 'btn btn-sm btn-outline-primary' + (titleHref ? '' : ' disabled');
				viewLink.textContent = forumsMod.dataset.labelViewThread || 'View Thread';
				if (titleHref) viewLink.href = titleHref;
				viewLink.target = '_blank';
				actionsDiv.appendChild(viewLink);

				/* HATEOAS: only render Validate button if the item has update/patch actions */
				if (flag.actions && (flag.actions['update'] || flag.actions['patch'] || flag.actions['PUT'])) {
					var patchHref = (flag.actions['patch'] && flag.actions['patch'].href)
						|| (flag.actions['update'] && flag.actions['update'].href)
						|| (flag.actions['PUT'] && flag.actions['PUT'].href)
						|| (portalURL + '/o/c/forumsuspiciousactivities/' + flag.id);

					var validateBtn = document.createElement('button');
					validateBtn.className = isValidated ? 'btn btn-sm btn-outline-secondary' : 'btn btn-sm btn-outline-success';
					validateBtn.textContent = isValidated
						? (forumsMod.dataset.labelPending || 'Pending')
						: (forumsMod.dataset.labelValidate || 'Validate');
					validateBtn.addEventListener('click', (function(flagId, flagHref, validated) {
						return function() {
							var btn = this;
							btn.disabled = true;
							Liferay.Util.fetch(flagHref, {
								headers: headers,
								method: 'PATCH',
								body: JSON.stringify({ validated: !validated })
							})
							.then(function(r) {
								if (r.ok) {
									showToast(forumsMod.dataset.labelFlagValidated || 'Flag has been validated.');
									loadFlags();
								} else {
									btn.disabled = false;
									console.error('Validate failed');
								}
							})
							.catch(function(err) {
								btn.disabled = false;
								console.error('Validate error:', err);
							});
						};
					})(flag.id, patchHref, isValidated));
					actionsDiv.appendChild(validateBtn);
				}

				/* Ban Author button (if validated and has author) */
				if (isValidated && authorId) {
					var banBtn = document.createElement('button');
					banBtn.className = 'btn btn-sm btn-outline-danger';
					banBtn.textContent = forumsMod.dataset.labelBanAuthor || 'Ban Author';
					banBtn.addEventListener('click', function() {
						var message = forumsMod.dataset.labelConfirmBanUser || 'Are you sure you want to ban this user?';
						showConfirmModal(message, forumsMod.dataset.labelBanAuthor || 'Ban Author', function() {
							banBtn.disabled = true;
							Liferay.Util.fetch(portalURL + '/o/c/forumbans/scopes/' + scopeGroupId, {
								headers: headers,
								method: 'POST',
								body: JSON.stringify({ banUserId: parseInt(authorId) })
							}).then(function(r) {
								if (r.ok) {
									banBtn.style.display = 'none';
									showToast(forumsMod.dataset.labelUserBanned || 'User has been banned.');
								} else {
									banBtn.disabled = false;
									console.error('Ban failed');
								}
							}).catch(function(e) { banBtn.disabled = false; console.error(e); });
						});
					});
					actionsDiv.appendChild(banBtn);
				}

				/* HATEOAS: only render Dismiss button if the item has delete action */
				if (flag.actions && flag.actions['delete']) {
					var deleteHref = flag.actions['delete'].href || (portalURL + '/o/c/forumsuspiciousactivities/' + flag.id);

					var dismissBtn = document.createElement('button');
					dismissBtn.className = 'btn btn-sm btn-outline-danger';
					dismissBtn.textContent = forumsMod.dataset.labelDismiss || 'Dismiss';
					dismissBtn.addEventListener('click', (function(flagItem, flagDeleteHref) {
						return function() {
							var message = forumsMod.dataset.labelConfirmDismiss || 'Are you sure you want to dismiss this flag?';
							showConfirmModal(message, forumsMod.dataset.labelDismiss || 'Dismiss', function() {
								var btn = dismissBtn;
								btn.disabled = true;
								Liferay.Util.fetch(flagDeleteHref, {
									headers: headers,
									method: 'DELETE'
								})
								.then(function(r) {
									if (r.ok) {
										flagItem.style.opacity = '0.5';
										setTimeout(function() {
											flagItem.remove();
											showToast(forumsMod.dataset.labelFlagDismissed || 'Flag has been dismissed.');
											/* Reload if list is now empty */
											if (flagList.querySelectorAll('.forums-moderation__flag-item').length === 0) {
												loadFlags();
											}
										}, 300);
									} else {
										btn.disabled = false;
										console.error('Dismiss failed');
									}
								})
								.catch(function(err) {
									btn.disabled = false;
									console.error('Dismiss error:', err);
								});
							});
						};
					})(item, deleteHref));
					actionsDiv.appendChild(dismissBtn);
				}

				item.appendChild(infoDiv);
				item.appendChild(actionsDiv);
				flagList.appendChild(item);
			});

			if (missingDisplayPage && Liferay.Util && Liferay.Util.openToast) {
				Liferay.Util.openToast({
					message: forumsMod.dataset.labelDisplayPageNotConfigured || 'Display page is not configured for one or more threads.',
					type: 'danger'
				});
			}

			/* Pagination */
			renderPagination(lastPage, loadFlags);
		})
		.catch(function(err) {
			if (loadingEl) loadingEl.style.display = 'none';

			/* On error (e.g. 403), show the permissions warning */
			if (cardEl) cardEl.style.display = 'none';
			if (noPermissionsEl) noPermissionsEl.style.display = '';
			console.error('Moderation load error:', err);
		});
	}

	loadFlags();
}

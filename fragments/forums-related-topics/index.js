var relatedTopics = fragmentElement.querySelector('#forumsRelatedTopics');

if (relatedTopics && !document.body.classList.contains('has-edit-mode-menu')) {
	var portalURL = Liferay.ThemeDisplay.getPortalURL();
	var scopeGroupId = Liferay.ThemeDisplay.getScopeGroupId();
	var headers = {
		'Accept': 'application/json',
		'Content-Type': 'application/json'
	};

	var listEl = relatedTopics.querySelector('#forumsRelatedTopicsList');
	var loadingEl = relatedTopics.querySelector('#forumsRelatedTopicsLoading');

	/* URL params */
	var urlParams = new URLSearchParams(window.location.search);
	var currentMessageId = urlParams.get('messageId');

	function runRelatedTopics(resolvedMessageId) {
		currentMessageId = resolvedMessageId;

		if (!currentMessageId) {
			if (loadingEl) loadingEl.remove();
			relatedTopics.style.display = 'none';
			return;
		}

	/* First, get the current message to find its category */
	Liferay.Util.fetch(portalURL + '/o/c/forummessages/' + currentMessageId, {
		headers: headers,
		method: 'GET'
	})
	.then(function(r) { return r.json(); })
	.then(function(msg) {
		var categoryId = msg.r_categoryMessages_c_forumCategoryId;

		/* Fetch other messages from the same category */
		var filterParts = [];
		if (categoryId) {
			filterParts.push('r_categoryMessages_c_forumCategoryId eq \'' + categoryId + '\'');
		}

		var url = portalURL + '/o/c/forummessages/scopes/' + scopeGroupId + '?pageSize=6&sort=lastPostDate:desc&nestedFields=messageSuspiciousActivities';
		if (filterParts.length > 0) {
			url += '&filter=' + encodeURIComponent(filterParts.join(' and '));
		}

		return Liferay.Util.fetch(url, { headers: headers, method: 'GET' });
	})
	.then(function(r) { return r.json(); })
	.then(function(data) {
		if (loadingEl) loadingEl.remove();

		var items = (data.items || []).filter(function(t) {
			return String(t.id) !== String(currentMessageId);
		}).slice(0, 5);

		if (items.length === 0) {
			listEl.innerHTML = '<div class="forums-related-topics__empty">' + (relatedTopics.dataset.labelNoRelated || 'No related topics found.') + '</div>';
			return;
		}

		var html = '';
		var missingDisplayPage = false;
		items.forEach(function(msg) {
			var title = msg.messageTitle || relatedTopics.dataset.labelUntitled || 'Untitled';
			var isFlagged = false;
			var suspiciousActivities = msg.messageSuspiciousActivities || [];
			for (var s = 0; s < suspiciousActivities.length; s++) {
				if (suspiciousActivities[s].validated === true) {
					isFlagged = true;
					break;
				}
			}

			var flaggedBadge = '';
			if (isFlagged) {
				var flaggedText = relatedTopics.dataset.labelFlagged || 'Flagged';
				flaggedBadge = '<span class="text-danger ml-2" style="font-size:0.85em"><svg class="lexicon-icon lexicon-icon-warning-full" role="presentation" viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M16 14.5L8 1 0 14.5h16zM8 13c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm1-3H7V6h2v4z"/></svg> ' + flaggedText + '</span>';
			}

			if (msg.friendlyUrlPath) {
				var siteSlug = (msg.scopeKey || '').toLowerCase().replace(/ /g, '-');
				var messageHref = Liferay.ThemeDisplay.getPathFriendlyURLPublic() + '/' + siteSlug + '/-c-forum-message-/' + msg.friendlyUrlPath;
				html += '<a href="' + messageHref + '" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">'
					+ '<span>' + Liferay.Util.escapeHTML(title) + '</span>' + flaggedBadge + '</a>';
			} else {
				missingDisplayPage = true;
				html += '<div class="list-group-item d-flex justify-content-between align-items-center">'
					+ '<span>' + Liferay.Util.escapeHTML(title) + '</span>' + flaggedBadge + '</div>';
			}
		});

		listEl.innerHTML = html;

		if (missingDisplayPage && Liferay.Util && Liferay.Util.openToast) {
			Liferay.Util.openToast({
				message: relatedTopics.dataset.labelDisplayPageNotConfigured || 'Display page is not configured for one or more messages.',
				type: 'danger'
			});
		}
	})
	.catch(function(err) {
		if (loadingEl) loadingEl.remove();
		listEl.innerHTML = '<div class="forums-related-topics__empty">' + (relatedTopics.dataset.labelUnableToLoad || 'Unable to load related topics.') + '</div>';
		console.error('ForumsRelatedTopics error:', err);
	});
	} // end runRelatedTopics

	/* Resolve messageId: ?messageId param → mapped reply ERC → mapped message ERC → URL path slug */
	if (currentMessageId) {
		runRelatedTopics(currentMessageId);
	} else {
		/* Reply ERC takes priority — set when this fragment is on a Forum Reply Display Page */
		var replyErcEl = relatedTopics.querySelector('#forumsRelatedTopicsReplyERC');
		var replyErc = replyErcEl ? replyErcEl.textContent.trim() : null;
		if (replyErc === 'Mappable Reply ERC') replyErc = null;

		if (replyErc) {
			Liferay.Util.fetch(portalURL + '/o/c/forumreplies/scopes/' + scopeGroupId + '/by-external-reference-code/' + encodeURIComponent(replyErc), {
				headers: headers,
				method: 'GET'
			})
			.then(function(r) {
				if (!r.ok) throw new Error('Not found');
				return r.json();
			})
			.then(function(reply) {
				var parentMessageId = reply.r_messageReplies_c_forumMessageId;
				runRelatedTopics(parentMessageId ? String(parentMessageId) : null);
			})
			.catch(function() { runRelatedTopics(null); });
		} else {
			var ercEl = relatedTopics.querySelector('#forumsRelatedTopicsERC');
			var erc = ercEl ? ercEl.textContent.trim() : null;
			if (erc === 'Mappable Message ERC') erc = null;

			if (!erc) {
				if (loadingEl) loadingEl.remove();
				listEl.innerHTML = '<div class="forums-related-topics__empty">' + (relatedTopics.dataset.labelErcNotMapped || 'Message ERC is not mapped.') + '</div>';
			} else {
				Liferay.Util.fetch(portalURL + '/o/c/forummessages/scopes/' + scopeGroupId + '/by-external-reference-code/' + encodeURIComponent(erc), {
					headers: headers,
					method: 'GET'
				})
				.then(function(r) {
					if (!r.ok) throw new Error('Not found');
					return r.json();
				})
				.then(function(data) {
					runRelatedTopics(data.id ? String(data.id) : null);
				})
				.catch(function() { runRelatedTopics(null); });
			}
		}
	}
}

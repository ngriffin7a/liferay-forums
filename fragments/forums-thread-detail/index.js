var threadDetail = fragmentElement.querySelector('#forumsThreadDetail');

if (threadDetail) {
	var portalURL = Liferay.ThemeDisplay.getPortalURL();
	var scopeGroupId = Liferay.ThemeDisplay.getScopeGroupId();
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
	var currentUserId = Liferay.ThemeDisplay.getUserId();
	var headers = {
		'Accept': 'application/json',
		'Content-Type': 'application/json'
	};
	var clayIconsUrl = Liferay.ThemeDisplay.getPathThemeImages() + '/clay/icons.svg';

	/* DOM refs */
	var titleEl = threadDetail.querySelector('#forumsDetailTitle');
	var loadingEl = threadDetail.querySelector('#forumsDetailLoading');
	var opSection = threadDetail.querySelector('#forumsDetailOP');
	var opBody = threadDetail.querySelector('#forumsDetailOPBody');
	var opAvatar = threadDetail.querySelector('#forumsDetailOPAvatar');
	var opAuthor = threadDetail.querySelector('#forumsDetailOPAuthor');
	var opDate = threadDetail.querySelector('#forumsDetailOPDate');
	var opViews = threadDetail.querySelector('#forumsDetailOPViews');
	var opTags = threadDetail.querySelector('#forumsDetailOPTags');
	var solvedBanner = threadDetail.querySelector('#forumsDetailSolvedBanner');
	var solutionSection = threadDetail.querySelector('#forumsDetailSolutionSection');
	var solutionCards = threadDetail.querySelector('#forumsDetailSolutionCards');
	var solutionCount = threadDetail.querySelector('#forumsDetailSolutionCount');
	var repliesSection = threadDetail.querySelector('#forumsDetailRepliesSection');
	var replyCards = threadDetail.querySelector('#forumsDetailReplyCards');
	var replyCountEl = threadDetail.querySelector('#forumsDetailReplyCount');
	var replyBtn = threadDetail.querySelector('#forumsDetailReplyBtn');
	var flagBtn = threadDetail.querySelector('#forumsDetailFlagBtn');
	/* HATEOAS: hide write-action buttons by default; show after API confirms permission */
	if (replyBtn) {
		replyBtn.style.display = 'none';
		replyBtn.setAttribute('title', threadDetail.dataset.labelReply || 'Reply');
		replyBtn.setAttribute('aria-label', threadDetail.dataset.labelReply || 'Reply');
		replyBtn.innerHTML = `<svg class="lexicon-icon lexicon-icon-reply" role="presentation"><use href="${clayIconsUrl}#reply"></use></svg>`;
	}
	if (flagBtn) flagBtn.style.display = 'none';
	var breadcrumbCategory = threadDetail.querySelector('#forumsDetailBreadcrumbCategory');
	var breadcrumbThread = threadDetail.querySelector('#forumsDetailBreadcrumbThread');
	var allTopicsLink = threadDetail.querySelector('#forumsDetailAllTopics');
	var categoryLink = threadDetail.querySelector('#forumsDetailCategoryLink');

	if (allTopicsLink) {
		allTopicsLink.href = sitePrefix + ((typeof configuration !== 'undefined' && configuration.communityURL) ? configuration.communityURL : '/forums');
	}

	// Also fix the hidden community breadcrumb link, which could be the 1st one
	var communityBreadcrumb = threadDetail.querySelector('.forums-thread-detail__breadcrumb li:first-child a');
	if (communityBreadcrumb) {
		communityBreadcrumb.href = sitePrefix + ((typeof configuration !== 'undefined' && configuration.communityURL) ? configuration.communityURL : '/forums');
	}
	var replyPaginationNav = threadDetail.querySelector('#forumsDetailReplyPagination');
	var replyPaginationUl = threadDetail.querySelector('#forumsDetailReplyPaginationUl');

	/* URL params */
	var urlParams = new URLSearchParams(window.location.search);
	var threadId = urlParams.get('threadId');

	/* Options Dropdown Vanilla JS Fallback */
	var optionsBtn = threadDetail.querySelector('#forumsDetailOptions');
	if (optionsBtn && Liferay.ThemeDisplay.isSignedIn()) {
		var optionsDropdown = threadDetail.querySelector('#forumsDetailOptionsDropdown');
		if (optionsDropdown) optionsDropdown.style.display = '';
		var optionsMenu = optionsBtn.nextElementSibling;
		optionsBtn.addEventListener('click', function(e) {
			e.preventDefault();
			if (optionsMenu) {
				var expanded = optionsMenu.classList.toggle('show');
				optionsBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
			}
		});
		document.addEventListener('click', function(e) {
			if (optionsMenu && !optionsBtn.contains(e.target) && !optionsMenu.contains(e.target)) {
				optionsMenu.classList.remove('show');
				optionsBtn.setAttribute('aria-expanded', 'false');
			}
		});
		document.addEventListener('keydown', function(e) {
			if (e.key === 'Escape' && optionsMenu && optionsMenu.classList.contains('show')) {
				optionsMenu.classList.remove('show');
				optionsBtn.setAttribute('aria-expanded', 'false');
				optionsBtn.focus();
			}
		});
	}

	function runThreadDetail(resolvedThreadId, replyId) {
	threadId = resolvedThreadId;
	var targetReplyId = replyId || null;
	if (!threadId) {
		if (loadingEl) loadingEl.innerHTML = '<div class="forums-thread-list__empty">' + (threadDetail.dataset.labelNoThread || 'No thread selected.') + '</div>';
		return;
	}

	var replyPageSize = 10;
	var currentReplyPage = 1;
	var newViewCount = 0;
	var isBanned = false;

	/* Utility functions */
	function indentHtmlText(text) {
		var voidTag = /^<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)(\s|>|\/)/i;
		var pad = '  ';
		var indent = 0;
		return text.split('\n').map(function(line) {
			line = line.trim();
			if (!line) return '';
			var isClosing = /^<\//.test(line);
			var isOpening = /^<[^\/!?]/.test(line);
			var isSelfClose = /\/\s*>$/.test(line) || voidTag.test(line);
			var hasInlineClose = isOpening && !isSelfClose && /<\/[^>]+>\s*$/.test(line);
			if (isClosing) indent = Math.max(0, indent - 1);
			var result = pad.repeat(indent) + line;
			if (isOpening && !isSelfClose && !hasInlineClose) indent++;
			return result;
		}).join('\n');
	}

	function formatMarkupCodeBlocks(container) {
		container.querySelectorAll('pre code').forEach(function(codeEl) {
			var text = codeEl.textContent;
			if (text.indexOf('\n') === -1 && text.indexOf('> <') !== -1) {
				text = text.replace(/>\s+</g, '>\n<');
				text = indentHtmlText(text);
				codeEl.textContent = text;
			}
		});
	}

	function formatDate(dateStr) {
		if (!dateStr) return '';
		var d = new Date(dateStr);
		return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
	}

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

	function renderAvatar(creator, size) {
		var cls = size === 'sm' ? 'forums-thread-detail__reply-avatar' : 'forums-thread-detail__author-avatar';
		if (creator && creator.image) {
			return '<div class="' + cls + '"><img src="' + Liferay.Util.escapeHTML(creator.image) + '" alt="' + Liferay.Util.escapeHTML(displayName(creator)) + '"></div>';
		}
		var name = displayName(creator);
		return '<div class="' + cls + '">' + avatarInitial(name) + '</div>';
	}

	/* Vote state: maps messageId -> { voteId, voteValue } for current user */
	var userVoteMap = {};
	var opCreatorId = null; /* Track thread owner for Mark as Answer */
	var currentAnswerId = null; /* Track currently accepted answer message ID */
	var threadDeleteUrl = null; /* Track HATEOAS URL to delete the whole thread */
	var canUpdateThread = false; /* HATEOAS: set true when ForumThreads API exposes update action for this thread */
	var canVote = false; /* HATEOAS: set true when ForumVotes API exposes create action */
	var canReply = false; /* HATEOAS: set true when ForumReplies API exposes create action */
	var isThreadQuestion = false; /* Track if the thread was marked as a question */
	var threadCategoryFK = null;
	var threadTitleText = '';
	var threadTagsArray = [];
	var replyMessagesMap = {};
	var existingFlagId = null; /* Track if the current user already flagged this thread */

	function renderReplyCard(msg, isSolution, depth) {
		depth = depth || 0;
		var creator = msg.creator || {};
		var name = displayName(creator) || threadDetail.dataset.labelUnknown || 'Unknown';
		var body = msg.body || '';
		var date = formatDate(msg.dateCreated);
		var score = msg.voteScore || 0;
		var solClass = isSolution ? ' forums-thread-detail__reply-card--solution' : '';
		var depthClass = depth > 0 ? ' forums-thread-detail__reply-card--nested' : '';
		var depthStyle = depth > 0 ? ' style="margin-left:' + (depth * 2.5) + 'rem"' : '';
		var userVote = userVoteMap[msg.id];
		var upActive = userVote && userVote.voteValue === 1 ? ' active' : '';
		var downActive = userVote && userVote.voteValue === -1 ? ' active' : '';
		var isUpPressed = userVote && userVote.voteValue === 1 ? 'true' : 'false';
		var isDownPressed = userVote && userVote.voteValue === -1 ? 'true' : 'false';
		var upIcon = userVote && userVote.voteValue === 1 ? 'thumbs-up-full' : 'thumbs-up';
		var downIcon = userVote && userVote.voteValue === -1 ? 'thumbs-down-full' : 'thumbs-down';

		var hasEditAction = !!(msg.actions && (msg.actions['update'] || msg.actions['patch'] || msg.actions['PUT']));
		var hasDeleteAction = !!(msg.actions && msg.actions['delete']);
		var replyBtnSpacerClass = (hasEditAction || hasDeleteAction) ? ' mr-2' : '';
		var editBtnSpacerClass = hasDeleteAction ? ' mr-2' : '';
		var canMarkAnswer = isThreadQuestion && (canUpdateThread || (opCreatorId && String(opCreatorId) === String(currentUserId))) && depth === 0;

		return `<div class="forums-thread-detail__reply-card${solClass}${depthClass}" data-message-id="${msg.id}"${depthStyle}>
			<div class="forums-thread-detail__reply-layout">
				<div class="align-items-center d-inline-flex justify-content-start text-secondary mr-3 forums-vote" data-message-id="${msg.id}">
					<button class="btn-thumbs-up btn btn-outline-borderless btn-sm btn-outline-secondary forums-vote__btn forums-vote__btn--up${upActive}" type="button" aria-pressed="${isUpPressed}"${canVote ? ` data-vote-dir="up" data-message-id="${msg.id}"` : ' disabled'} title="Upvote">
						<span class="inline-item inline-item-before">
							<svg class="lexicon-icon lexicon-icon-${upIcon}" role="presentation"><use href="${clayIconsUrl}#${upIcon}"></use></svg>
						</span>
					</button>
					<span class="font-weight-bold p-1 forums-vote__score" data-vote-score="${msg.id}">${score}</span>
					<button class="btn-thumbs-down btn btn-outline-borderless btn-sm btn-outline-secondary forums-vote__btn forums-vote__btn--down${downActive}" type="button" aria-pressed="${isDownPressed}"${canVote ? ` data-vote-dir="down" data-message-id="${msg.id}"` : ' disabled'} title="Downvote">
						<span class="inline-item inline-item-before">
							<svg class="lexicon-icon lexicon-icon-${downIcon}" role="presentation"><use href="${clayIconsUrl}#${downIcon}"></use></svg>
						</span>
					</button>
				</div>
				<div class="forums-thread-detail__reply-content">
					${isSolution ? `<span class="forums-vote__accepted-badge">&#10003; ${threadDetail.dataset.labelAccepted || 'Accepted'}</span>` : ''}
					<div class="forums-thread-detail__reply-body">${body}</div>
					<div class="forums-thread-detail__reply-author">
						<div class="forums-thread-detail__reply-author-info">
							${renderAvatar(creator, 'sm')}
							<span class="forums-thread-detail__reply-name">${Liferay.Util.escapeHTML(name)}</span>
							<span class="forums-thread-detail__reply-date">${date}</span>
						</div>
						<div class="forums-thread-detail__reply-actions">
							${canMarkAnswer ? `<button class="btn btn-sm mr-2 ${isSolution ? 'btn-success' : 'btn-secondary'} forums-answer-btn" data-answer-message-id="${msg.id}" data-is-answer="${isSolution ? 'true' : 'false'}">${isSolution ? `&#10003; ${threadDetail.dataset.labelAccepted || 'Accepted'}` : (threadDetail.dataset.labelMarkAsAnswer || 'Mark as Answer')}</button>` : ''}
							${canReply ? `<button class="btn btn-secondary btn-sm${replyBtnSpacerClass}" data-forums-compose data-forums-reply data-forums-message-id="${msg.id}" title="${threadDetail.dataset.labelReply || 'Reply'}" aria-label="${threadDetail.dataset.labelReply || 'Reply'}"><svg class="lexicon-icon lexicon-icon-reply" role="presentation"><use href="${clayIconsUrl}#reply"></use></svg></button>` : ''}
							${hasEditAction ? `<button class="btn btn-secondary btn-sm forums-edit-reply-btn${editBtnSpacerClass}" data-message-id="${msg.id}" title="${threadDetail.dataset.labelEditReply || 'Edit Reply'}" aria-label="${threadDetail.dataset.labelEditReply || 'Edit Reply'}"><svg class="lexicon-icon lexicon-icon-pencil" role="presentation"><use href="${clayIconsUrl}#pencil"></use></svg></button>` : ''}
							${hasDeleteAction ? `<button class="btn btn-danger btn-sm forums-delete-btn" data-delete-url="${msg.actions['delete'].href}" title="${threadDetail.dataset.labelDelete || 'Delete'}" aria-label="${threadDetail.dataset.labelDelete || 'Delete'}"><svg class="lexicon-icon lexicon-icon-trash" role="presentation"><use href="${clayIconsUrl}#trash"></use></svg></button>` : ''}
						</div>
					</div>
				</div>
			</div>
		</div>`;
	}

	/* Sort messages: accepted answers first, then by voteScore desc, then dateCreated asc */
	function sortByVoteScore(messages) {
		return messages.slice().sort(function(a, b) {
			/* Accepted answers first */
			var aAnswer = isThreadQuestion && a.answer === true ? 1 : 0;
			var bAnswer = isThreadQuestion && b.answer === true ? 1 : 0;
			if (bAnswer !== aAnswer) return bAnswer - aAnswer;
			/* Higher score first */
			var aScore = a.voteScore || 0;
			var bScore = b.voteScore || 0;
			if (bScore !== aScore) return bScore - aScore;
			/* Older first as tiebreaker */
			return new Date(a.dateCreated) - new Date(b.dateCreated);
		});
	}

	/* Build a tree from flat messages using parentMessageId */
	function buildMessageTree(messages, opId) {
		var childrenMap = {};
		var topLevel = [];
		var messageIds = {};

		messages.forEach(function(msg) {
			messageIds[msg.id] = true;
		});

		messages.forEach(function(msg) {
			var parentId = msg.parentMessageId || 0;
			
			/* If a message's parent is missing (e.g. deleted or on a different page), treat it as top-level */
			if (parentId !== 0 && parentId !== opId && !messageIds[parentId]) {
				parentId = opId;
			}
			
			if (!childrenMap[parentId]) childrenMap[parentId] = [];
			childrenMap[parentId].push(msg);
		});

		/* Top-level replies: parentMessageId is 0 or equals the OP id */
		topLevel = (childrenMap[0] || []).concat(childrenMap[opId] || []);

		/* Remove duplicates (if opId is 0, both keys point to same array) */
		if (opId === 0) {
			topLevel = childrenMap[0] || [];
		}

		/* Sort top-level replies by score */
		topLevel = sortByVoteScore(topLevel);

		function renderTree(msgList, depth) {
			var html = '';
			msgList.forEach(function(msg) {
				html += renderReplyCard(msg, isThreadQuestion && msg.answer === true, depth);
				var children = childrenMap[msg.id];
				if (children && children.length > 0) {
					html += renderTree(sortByVoteScore(children), depth + 1);
				}
			});
			return html;
		}

		return renderTree(topLevel, 0);
	}

	/* Fetch current user's votes for all messages in this thread */
	function fetchUserVotes(messageIds, callback) {
		if (!messageIds || messageIds.length === 0) { callback(); return; }
		if (!Liferay.ThemeDisplay.isSignedIn()) { callback(); return; }
		/* Filter by current user's ID to only get this user's votes */
		var filterParam = encodeURIComponent('creatorId eq ' + currentUserId);
		Liferay.Util.fetch(portalURL + '/o/c/forumvotes/scopes/' + scopeGroupId + '?filter=' + filterParam + '&pageSize=200', {
			headers: headers,
			method: 'GET'
		})
		.then(function(r) { return r.json(); })
		.then(function(data) {
			/* HATEOAS: check if this user can create votes */
			if (!isBanned && data.actions && (data.actions['POST'] || data.actions['post'] || data.actions['create'])) {
				canVote = true;
			} else if (!isBanned && canReply) {
				/* Fallback: if HATEOAS is missing from the filtered votes endpoint but the user can reply, allow voting */
				canVote = true;
			}
			var items = data.items || [];
			userVoteMap = {};
			var messageIdSet = {};
			messageIds.forEach(function(id) { messageIdSet[id] = true; });
			items.forEach(function(vote) {
				var msgId = vote.r_replyVotes_c_forumReplyId;
				if (msgId && messageIdSet[msgId]) {
					userVoteMap[msgId] = { voteId: vote.id, voteValue: vote.voteValue };
				}
			});
			callback();
		})
		.catch(function() { callback(); });
	}

	/* Handle upvote/downvote click */
	function handleVote(messageId, direction) {
		if (!canVote) return;
		var voteValue = direction === 'up' ? 1 : -1;
		var existing = userVoteMap[messageId];

		if (existing) {
			if (existing.voteValue === voteValue) {
				/* Same direction: remove the vote (toggle off) */
				Liferay.Util.fetch(portalURL + '/o/c/forumvotes/' + existing.voteId, {
					headers: headers,
					method: 'DELETE'
				})
				.then(function() {
					delete userVoteMap[messageId];
					updateVoteScore(messageId, -voteValue);
				})
				.catch(function(err) { console.error('Vote delete error:', err); });
			} else {
				/* Opposite direction: delete old, create new */
				Liferay.Util.fetch(portalURL + '/o/c/forumvotes/' + existing.voteId, {
					headers: headers,
					method: 'DELETE'
				})
				.then(function() {
					return createVote(messageId, voteValue);
				})
				.then(function() {
					/* Score swings by 2: removed old + added new */
					updateVoteScore(messageId, voteValue * 2);
				})
				.catch(function(err) { console.error('Vote switch error:', err); });
			}
		} else {
			/* No existing vote: create new */
			createVote(messageId, voteValue)
			.then(function() {
				updateVoteScore(messageId, voteValue);
			})
			.catch(function(err) { console.error('Vote create error:', err); });
		}
	}

	function createVote(messageId, voteValue) {
		return Liferay.Util.fetch(portalURL + '/o/c/forumvotes/scopes/' + scopeGroupId, {
			headers: headers,
			method: 'POST',
			body: JSON.stringify({
				voteValue: voteValue,
				r_replyVotes_c_forumReplyId: messageId
			})
		})
		.then(function(r) { return r.json(); })
		.then(function(vote) {
			userVoteMap[messageId] = { voteId: vote.id, voteValue: voteValue };
		});
	}

	function updateVoteScore(messageId, delta) {
		/* Update the score in the DOM */
		var scoreEl = threadDetail.querySelector('[data-vote-score="' + messageId + '"]');
		if (scoreEl) {
			var current = parseInt(scoreEl.textContent) || 0;
			var newScore = current + delta;
			scoreEl.textContent = newScore;
		}

		/* Update button active states and icons */
		var voteContainer = threadDetail.querySelector('.forums-vote[data-message-id="' + messageId + '"]');
		if (voteContainer) {
			var upBtn = voteContainer.querySelector('.forums-vote__btn--up');
			var downBtn = voteContainer.querySelector('.forums-vote__btn--down');
			var userVote = userVoteMap[messageId];
			var isUp = !!(userVote && userVote.voteValue === 1);
			var isDown = !!(userVote && userVote.voteValue === -1);
			
			if (upBtn) {
				upBtn.classList.toggle('active', isUp);
				upBtn.setAttribute('aria-pressed', isUp ? 'true' : 'false');
				var upSvg = upBtn.querySelector('use');
				if (upSvg) upSvg.setAttribute('href', clayIconsUrl + '#' + (isUp ? 'thumbs-up-full' : 'thumbs-up'));
			}
			if (downBtn) {
				downBtn.classList.toggle('active', isDown);
				downBtn.setAttribute('aria-pressed', isDown ? 'true' : 'false');
				var downSvg = downBtn.querySelector('use');
				if (downSvg) downSvg.setAttribute('href', clayIconsUrl + '#' + (isDown ? 'thumbs-down-full' : 'thumbs-down'));
			}
		}

		/* Also PATCH the ForumReply to persist the denormalized score */
		if (scoreEl) {
			var persistedScore = parseInt(scoreEl.textContent) || 0;
			Liferay.Util.fetch(portalURL + '/o/c/forumreplies/' + messageId, {
				headers: headers,
				method: 'PATCH',
				body: JSON.stringify({ voteScore: persistedScore })
			}).catch(function(err) { console.error('Score persist error:', err); });
		}
	}

	/* Attach vote click handlers after rendering */
	function attachVoteHandlers() {
		threadDetail.querySelectorAll('.forums-vote__btn').forEach(function(btn) {
			btn.addEventListener('click', function(e) {
				e.preventDefault();
				var msgId = this.getAttribute('data-message-id');
				var dir = this.getAttribute('data-vote-dir');
				if (msgId && dir) handleVote(parseInt(msgId), dir);
			});
		});
	}

	/* Mark / Unmark as Answer */
	function handleMarkAnswer(messageId, isCurrentlyAnswer) {
		if (isCurrentlyAnswer) {
			/* Unmark this answer */
			Liferay.Util.fetch(portalURL + '/o/c/forumreplies/' + messageId, {
				headers: headers,
				method: 'PATCH',
				body: JSON.stringify({ answer: false })
			})
			.then(function(r) {
				if (r.ok) {
					currentAnswerId = null;
					setTimeout(loadMessages, 1500);
				}
			})
			.catch(function(err) { console.error('Unmark answer error:', err); });
		} else {
			/* If another answer exists, unmark it first */
			var chain = Promise.resolve();
			if (currentAnswerId && currentAnswerId !== messageId) {
				chain = Liferay.Util.fetch(portalURL + '/o/c/forumreplies/' + currentAnswerId, {
					headers: headers,
					method: 'PATCH',
					body: JSON.stringify({ answer: false })
				});
			}
			chain.then(function() {
				return Liferay.Util.fetch(portalURL + '/o/c/forumreplies/' + messageId, {
					headers: headers,
					method: 'PATCH',
					body: JSON.stringify({ answer: true })
				});
			})
			.then(function(r) {
				if (r.ok) {
					currentAnswerId = messageId;
					setTimeout(loadMessages, 1500);
				}
			})
			.catch(function(err) { console.error('Mark answer error:', err); });
		}
	}

	function attachAnswerHandlers() {
		threadDetail.querySelectorAll('.forums-answer-btn').forEach(function(btn) {
			btn.addEventListener('click', function(e) {
				e.preventDefault();
				var msgId = parseInt(this.getAttribute('data-answer-message-id'));
				var isAnswer = this.getAttribute('data-is-answer') === 'true';
				
				this.style.opacity = '0.5';
				this.style.pointerEvents = 'none';
				
				handleMarkAnswer(msgId, isAnswer);
			});
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

			modal.innerHTML = `
			<div class="modal-dialog modal-dialog-sm modal-dialog-centered modal-danger">
				<div class="modal-content">
					<div class="modal-header">
						<h1 class="modal-title" tabindex="-1">
							<div class="modal-title-indicator">
								<svg class="lexicon-icon lexicon-icon-exclamation-full" role="presentation">
									<use href="${clayIconsUrl}#exclamation-full"></use>
								</svg>
							</div>
							<span id="forumsDeleteModalHeading"></span>
						</h1>
						<button class="close btn btn-unstyled forums-delete-modal-close" type="button" aria-label="Close">
							<svg class="lexicon-icon lexicon-icon-times" role="presentation">
								<use href="${clayIconsUrl}#times"></use>
							</svg>
						</button>
					</div>
					<div class="modal-body">
						<div class="liferay-modal-body" id="forumsDeleteModalBody"></div>
					</div>
					<div class="modal-footer">
						<div class="modal-item-last">
							<div class="btn-group-spaced" role="group">
								<button class="btn btn-secondary forums-delete-modal-close" type="button">${threadDetail.dataset.labelCancel || 'Cancel'}</button>
								<button class="btn btn-danger" type="button" id="forumsDeleteModalConfirmBtn">${threadDetail.dataset.labelDelete || 'Delete'}</button>
							</div>
						</div>
					</div>
				</div>
			</div>`;
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

	/* Delete Reply */
	function attachDeleteHandlers() {
		threadDetail.querySelectorAll('.forums-delete-btn').forEach(function(btn) {
			btn.addEventListener('click', function(e) {
				e.preventDefault();
				var isReply = this.closest('.forums-thread-detail__reply-card');
				var title = isReply ? (threadDetail.dataset.labelDeleteReply || 'Delete Reply') : (threadDetail.dataset.labelDeleteTopic || 'Delete Topic');
				var confirmMsg = isReply ? (threadDetail.dataset.labelConfirmDeleteReply || 'Deleting a reply is an action impossible to revert. It will not be possible to recover it.') : (threadDetail.dataset.labelConfirmDeleteTopic || 'Deleting a topic is an action impossible to revert. All the replies in the topic will be removed and it will not be possible to recover them.');
				
				var deleteUrl = this.getAttribute('data-delete-url');
				var btnEl = this;
				
				showDeleteModal(title, confirmMsg, function() {
					Liferay.Util.fetch(deleteUrl, {
						headers: headers,
						method: 'DELETE'
					})
					.then(function(r) {
						if (r.ok) {
							/* Optimistically remove the card from the DOM */
							var card = btnEl.closest('.forums-thread-detail__reply-card');
							if (card) {
								card.style.opacity = '0.5';
								setTimeout(function() { card.remove(); }, 300);
								/* Delay the reload to allow the backend search index to catch up */
								setTimeout(loadMessages, 1500);
							} else {
								/* This is the Original Post being deleted — navigate back to the thread list */
								var opSection = threadDetail.querySelector('#forumsDetailOP');
								if (opSection) opSection.style.opacity = '0.5';
								var breadcrumbCatEl = threadDetail.querySelector('#forumsDetailBreadcrumbCategory');
								var threadsBase = sitePrefix + ((typeof configuration !== 'undefined' && configuration.threadsURL) ? configuration.threadsURL : '/forum-threads');
								var targetHref = (breadcrumbCatEl && breadcrumbCatEl.href) ? breadcrumbCatEl.href
									: (threadCategoryFK ? threadsBase + '?categoryId=' + threadCategoryFK : threadsBase);
								setTimeout(function() {
									window.location.href = targetHref;
								}, 1500);
							}
						} else {
							console.error('Failed to delete message');
						}
					})
					.catch(function(err) { console.error('Delete message error:', err); });
				});
			});
		});
	}

	function attachEditReplyHandlers() {
		threadDetail.querySelectorAll('.forums-edit-reply-btn').forEach(function(btn) {
			btn.addEventListener('click', function(e) {
				e.preventDefault();
				var msgId = parseInt(this.getAttribute('data-message-id'));
				var msg = replyMessagesMap[msgId];
				if (msg && window.forumsOpenComposeModal) {
					window.forumsOpenComposeModal({
						editMode: true,
						isOp: false,
						messageId: msg.id,
						body: msg.body
					});
				}
			});
		});
	}

	/* Load thread data */
	function initThreadDetail() {
		if (isBanned) {
			var bannedBanner = document.createElement('div');
			bannedBanner.className = 'alert alert-danger mt-3';
			bannedBanner.setAttribute('role', 'alert');
			bannedBanner.innerHTML = `<span class="alert-indicator"><svg class="lexicon-icon lexicon-icon-warning-full" role="presentation" viewBox="0 0 16 16" fill="currentColor"><path d="M16 14.5L8 1 0 14.5h16zM8 13c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm1-3H7V6h2v4z"/></svg></span><strong class="lead">${threadDetail.dataset.labelBanned || 'Banned'}: </strong>${threadDetail.dataset.labelBannedWarning || 'Your account has been banned from participating in the forums.'}`;
			
			var titleRow = threadDetail.querySelector('.forums-thread-detail__title-row');
			if (titleRow) {
				titleRow.parentNode.insertBefore(bannedBanner, titleRow);
			}
		}

		Liferay.Util.fetch(portalURL + '/o/c/forumthreads/' + threadId + '?nestedFields=threadSuspiciousActivities', {
			headers: headers,
			method: 'GET'
		})
	.then(function(r) { return r.json(); })
	.then(function(thread) {
		if (isBanned) {
			if (thread.actions) thread.actions = {};
			if (optionsBtn) optionsBtn.style.display = 'none';
		}
		
		if (thread.actions && thread.actions['delete']) {
			threadDeleteUrl = thread.actions['delete'].href;
		}
		if (thread.actions && (thread.actions['update'] || thread.actions['patch'] || thread.actions['PUT'])) {
			canUpdateThread = true;
		}

		var subscribeBtn = threadDetail.querySelector('#forumsDetailSubscribeBtn');
		var currentSubscribeUrl = null;
		var isSubscribed = false;

		if (subscribeBtn && thread.actions && !isBanned) {
			if (thread.actions['unsubscribe']) {
				currentSubscribeUrl = thread.actions['unsubscribe'].href;
				isSubscribed = true;
			} else if (thread.actions['subscribe']) {
				currentSubscribeUrl = thread.actions['subscribe'].href;
				isSubscribed = false;
			}

			if (currentSubscribeUrl) {
				subscribeBtn.textContent = isSubscribed 
					? (threadDetail.dataset.labelUnsubscribe || 'Unsubscribe')
					: (threadDetail.dataset.labelSubscribe || 'Subscribe');
				subscribeBtn.style.display = '';

				var newSubBtn = subscribeBtn.cloneNode(true);
				subscribeBtn.parentNode.replaceChild(newSubBtn, subscribeBtn);
				subscribeBtn = newSubBtn;
				
				subscribeBtn.addEventListener('click', function(e) {
					e.preventDefault();
					var btn = this;
					btn.style.opacity = '0.5';
					btn.style.pointerEvents = 'none';
					
					Liferay.Util.fetch(currentSubscribeUrl, {
						headers: headers,
						method: 'POST'
					})
					.then(function(r) {
						if (r.ok) {
							isSubscribed = !isSubscribed;
							currentSubscribeUrl = isSubscribed 
								? currentSubscribeUrl.replace('/subscribe', '/unsubscribe')
								: currentSubscribeUrl.replace('/unsubscribe', '/subscribe');
								
							btn.textContent = isSubscribed 
								? (threadDetail.dataset.labelUnsubscribe || 'Unsubscribe')
								: (threadDetail.dataset.labelSubscribe || 'Subscribe');
							
							var optionsMenu = btn.closest('.dropdown-menu');
							if (optionsMenu) optionsMenu.classList.remove('show');
							
							if (Liferay.Util && Liferay.Util.openToast) {
								var toastMsg = isSubscribed 
									? (threadDetail.dataset.labelSubscribedToast || 'You have been subscribed to this thread.') 
									: (threadDetail.dataset.labelUnsubscribedToast || 'You have been unsubscribed from this thread.');
								Liferay.Util.openToast({
									message: toastMsg,
									title: threadDetail.dataset.labelSuccess || 'Success',
									type: 'success'
								});
							}
						}
					})
					.catch(function(err) { console.error('Subscription error:', err); })
					.finally(function() {
						btn.style.opacity = '1';
						btn.style.pointerEvents = '';
					});
				});
			}
		}

		/* Increment viewCount via REST PATCH (unique per session) */
		var currentViewCount = thread.viewCount;
		currentViewCount = currentViewCount || 0;
		var viewStorageKey = 'forums_viewed_' + currentUserId + '_' + threadId;
		var alreadyViewed = false;
		try { alreadyViewed = !!sessionStorage.getItem(viewStorageKey); } catch(e) {}

		if (!alreadyViewed && Liferay.ThemeDisplay.isSignedIn()) {
			newViewCount = currentViewCount + 1;
			Liferay.Util.fetch(portalURL + '/o/c/forumthreads/' + threadId, {
				method: 'PATCH',
				headers: headers,
				body: JSON.stringify({ viewCount: newViewCount })
			}).then(function(r) {
				return r.json().then(function(body) {
					if (r.ok) {
						try { sessionStorage.setItem(viewStorageKey, '1'); } catch(e) {}
					} else {
						console.error('View count update failed:', r.status, body);
					}
				});
			}).catch(function(err) { console.error('View count update error:', err); });
		} else {
			newViewCount = currentViewCount;
		}

		isThreadQuestion = thread.question === true;

		var isFlagged = false;
		var suspiciousActivities = thread.threadSuspiciousActivities || [];
		for (var s = 0; s < suspiciousActivities.length; s++) {
			if (suspiciousActivities[s].validated === true) {
				isFlagged = true;
				break;
			}
		}

		if (isFlagged) {
			var flaggedBanner = threadDetail.querySelector('#forumsDetailFlaggedBanner');
			if (!flaggedBanner) {
				flaggedBanner = document.createElement('div');
				flaggedBanner.id = 'forumsDetailFlaggedBanner';
				flaggedBanner.className = 'alert alert-danger mt-3';
				flaggedBanner.setAttribute('role', 'alert');
				flaggedBanner.innerHTML = `<span class="alert-indicator"><svg class="lexicon-icon lexicon-icon-warning-full" role="presentation" viewBox="0 0 16 16" fill="currentColor"><path d="M16 14.5L8 1 0 14.5h16zM8 13c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm1-3H7V6h2v4z"/></svg></span><strong class="lead">${threadDetail.dataset.labelFlagged || 'Flagged'}: </strong>${threadDetail.dataset.labelFlaggedWarning || 'This thread has been flagged and validated by moderators as inappropriate content.'}`;
				
				var titleRow = threadDetail.querySelector('.forums-thread-detail__title-row');
				if (titleRow) {
					titleRow.parentNode.insertBefore(flaggedBanner, titleRow.nextSibling);
				}
			} else {
				flaggedBanner.style.display = '';
			}
		}

		threadTitleText = thread.threadTitle || threadDetail.dataset.labelUntitledThread || 'Untitled Thread';
		threadCategoryFK = thread.r_categoryThreads_c_forumCategoryId;
		threadTagsArray = thread.keywords || [];
		var title = threadTitleText;
		var categoryFK = threadCategoryFK;

		if (titleEl) titleEl.textContent = title;
		if (breadcrumbThread) breadcrumbThread.textContent = title;

		/* Fetch category for breadcrumb */
		if (categoryFK) {
			Liferay.Util.fetch(portalURL + '/o/c/forumcategories/' + categoryFK, {
				headers: headers,
				method: 'GET'
			})
			.then(function(r) { return r.json(); })
			.then(function(cat) {
				var catName = cat.categoryName || threadDetail.dataset.labelCategory || 'Category';
				var threadsHref = sitePrefix + ((typeof configuration !== 'undefined' && configuration.threadsURL) ? configuration.threadsURL : '/forum-threads');
				var catURL = threadsHref + '?categoryId=' + categoryFK;

				if (breadcrumbCategory) {
					breadcrumbCategory.textContent = catName;
					breadcrumbCategory.href = catURL;
				}

				/* Also populate the bottom category link */
				if (categoryLink) {
					var labelText = (threadDetail.dataset.labelBackToX || 'Back to {0}').replace('{0}', catName);
					categoryLink.textContent = '\u00ab ' + labelText;
					categoryLink.href = catURL;
					categoryLink.style.display = '';
				}
			})
			.catch(function() {});
		}

		/* Check if the current user has already flagged this thread (dedup) */
		if (flagBtn && currentUserId) {
			Liferay.Util.fetch(portalURL + '/o/c/forumsuspiciousactivities/scopes/' + scopeGroupId + '?filter='
				+ encodeURIComponent('creatorId eq ' + currentUserId + ' and suspiciousThreadId eq ' + threadId)
				+ '&pageSize=1', {
				headers: headers,
				method: 'GET'
			})
			.then(function(r) { return r.json(); })
			.then(function(data) {
				var items = data.items || [];
				if (items.length > 0) {
					existingFlagId = items[0].id;
					flagBtn.textContent = threadDetail.dataset.labelFlagged || 'Flagged';
					flagBtn.classList.add('disabled');
					flagBtn.disabled = true;
				}
			})
			.catch(function(err) { console.error('Flag dedup check error:', err); });
		}

		/* Fetch messages for this thread */
		loadMessages();
	})
	.catch(function(err) {
		if (loadingEl) loadingEl.innerHTML = '<div class="forums-thread-list__empty">' + (threadDetail.dataset.labelUnableToLoadThread || 'Unable to load thread.') + '</div>';
		console.error('ForumsThreadDetail error:', err);
	});
	}

	/* Load messages */
	function loadMessages() {
		Liferay.Util.fetch(portalURL + '/o/c/forumreplies/scopes/' + scopeGroupId + '?filter='
			+ encodeURIComponent('r_threadReplies_c_forumThreadId eq \'' + threadId + '\'')
			+ '&sort=dateCreated:asc&page=' + currentReplyPage
			+ '&pageSize=' + replyPageSize, {
			headers: headers,
			method: 'GET'
		})
		.then(function(r) { return r.json(); })
		.then(function(data) {
			if (loadingEl) { loadingEl.style.display = 'none'; loadingEl.removeAttribute('aria-busy'); }

			var messages = data.items || [];
			var totalCount = data.totalCount || 0;
			var lastPage = data.lastPage || 1;

			if (messages.length === 0) return;
			
			if (isBanned) {
				messages.forEach(function(msg) {
					msg.actions = {};
				});
			}

			/* HATEOAS: check if this user can create messages (reply) */
			if (!isBanned && data.actions && (data.actions['POST'] || data.actions['post'] || data.actions['create'])) {
				canReply = true;
				if (replyBtn) replyBtn.style.display = '';
				if (flagBtn) flagBtn.style.display = '';
			}

			/* Fetch user votes FIRST, then render everything */
			var allMsgIds = messages.map(function(m) { return m.id; });
			fetchUserVotes(allMsgIds, function() {

			/* Clear existing DOM structures to prevent artifacts */
			if (solutionCards) solutionCards.innerHTML = '';
			if (replyCards) replyCards.innerHTML = '';
			if (solvedBanner) solvedBanner.style.display = 'none';
			if (solutionSection) solutionSection.style.display = 'none';
			if (repliesSection) repliesSection.style.display = 'none';

			/* Separate OP from replies */
			var opMsg = null;
			var replyMessages = [];

			messages.forEach(function(msg, idx) {
				replyMessagesMap[msg.id] = msg;
				if (currentReplyPage === 1 && idx === 0) {
					opMsg = msg;
				} else {
					replyMessages.push(msg);
				}
			});

			/* Render Original Post */
			if (opMsg) {
				var creator = opMsg.creator || {};
				opCreatorId = creator.id || null;
				if (opBody) {
					opBody.innerHTML = opMsg.body || '';
					formatMarkupCodeBlocks(opBody);
				}
				if (opAvatar && creator.image) {
					opAvatar.innerHTML = '<img src="' + Liferay.Util.escapeHTML(creator.image) + '" alt="' + Liferay.Util.escapeHTML(displayName(creator)) + '">';
				} else if (opAvatar) {
					opAvatar.textContent = avatarInitial(displayName(creator));
				}
				if (opAuthor) opAuthor.textContent = displayName(creator) || threadDetail.dataset.labelUnknown || 'Unknown';
				if (opDate) {
					var dateTmpl = threadDetail.dataset.labelPostedOn || 'Posted on: {0}';
					opDate.textContent = dateTmpl.replace('{0}', formatDate(opMsg.dateCreated));
				}
				if (opViews) {
					var viewLabel = threadDetail.dataset.labelViews || 'Views';
					opViews.textContent = newViewCount + ' ' + viewLabel;
				}

				/* Render OP Tags */
				if (opTags && threadTagsArray.length > 0) {
					var tagsHtml = threadTagsArray.map(function(tag) {
						return `<span class="label label-secondary forums-thread-detail__tag"><span class="label-item label-item-expand">${Liferay.Util.escapeHTML(tag)}</span></span>`;
					}).join('');
					opTags.innerHTML = tagsHtml;
					opTags.style.display = '';
				}

				if (opSection) opSection.style.display = '';

				/* Render OP vote buttons */
				var opVoteEl = threadDetail.querySelector('#forumsDetailOPVote');
				if (opVoteEl) {
					var opScore = opMsg.voteScore || 0;
					var opUserVote = userVoteMap[opMsg.id];
					var opUpActive = opUserVote && opUserVote.voteValue === 1 ? ' active' : '';
					var opDownActive = opUserVote && opUserVote.voteValue === -1 ? ' active' : '';
					var opIsUpPressed = opUserVote && opUserVote.voteValue === 1 ? 'true' : 'false';
					var opIsDownPressed = opUserVote && opUserVote.voteValue === -1 ? 'true' : 'false';
					var opUpIcon = opUserVote && opUserVote.voteValue === 1 ? 'thumbs-up-full' : 'thumbs-up';
					var opDownIcon = opUserVote && opUserVote.voteValue === -1 ? 'thumbs-down-full' : 'thumbs-down';
					
					opVoteEl.className = 'align-items-center d-inline-flex justify-content-center text-secondary mr-3 forums-vote';
					opVoteEl.setAttribute('data-message-id', opMsg.id);
					var upvoteTitle = threadDetail.dataset.labelUpvote || 'Upvote';
					var downvoteTitle = threadDetail.dataset.labelDownvote || 'Downvote';
					opVoteEl.innerHTML = `
						<button class="btn-thumbs-up btn btn-outline-borderless btn-sm btn-outline-secondary forums-vote__btn forums-vote__btn--up${opUpActive}" type="button" aria-pressed="${opIsUpPressed}"${canVote ? ` data-vote-dir="up" data-message-id="${opMsg.id}"` : ' disabled'} title="${upvoteTitle}">
							<span class="inline-item inline-item-before">
								<svg class="lexicon-icon lexicon-icon-${opUpIcon}" role="presentation"><use href="${clayIconsUrl}#${opUpIcon}"></use></svg>
							</span>
						</button>
						<span class="font-weight-bold p-1 forums-vote__score" data-vote-score="${opMsg.id}">${opScore}</span>
						<button class="btn-thumbs-down btn btn-outline-borderless btn-sm btn-outline-secondary forums-vote__btn forums-vote__btn--down${opDownActive}" type="button" aria-pressed="${opIsDownPressed}"${canVote ? ` data-vote-dir="down" data-message-id="${opMsg.id}"` : ' disabled'} title="${downvoteTitle}">
							<span class="inline-item inline-item-before">
								<svg class="lexicon-icon lexicon-icon-${opDownIcon}" role="presentation"><use href="${clayIconsUrl}#${opDownIcon}"></use></svg>
							</span>
						</button>`;
				}

				/* Render OP Delete/Edit buttons if permitted (HATEOAS) */
				var opActionsEl = threadDetail.querySelector('#forumsDetailOPActions');
				if (opActionsEl) {
					var oldDel = opActionsEl.querySelector('.forums-delete-btn');
					if (oldDel) oldDel.remove();
					var oldEdit = opActionsEl.querySelector('.forums-edit-btn');
					if (oldEdit) oldEdit.remove();
					
					var rBtn = opActionsEl.querySelector('#forumsDetailReplyBtn');
					
					if (rBtn && (canUpdateThread || threadDeleteUrl)) {
						rBtn.style.marginRight = '0.5rem';
					}
					
					/* Use the thread's update permissions */
					if (canUpdateThread) {
						var editBtn = document.createElement('button');
						editBtn.className = 'btn btn-secondary btn-sm forums-edit-btn';
						if (threadDeleteUrl) {
							editBtn.style.marginRight = '0.5rem';
						}
						editBtn.setAttribute('title', threadDetail.dataset.labelEditTopic || 'Edit Topic');
						editBtn.setAttribute('aria-label', threadDetail.dataset.labelEditTopic || 'Edit Topic');
						editBtn.innerHTML = `<svg class="lexicon-icon lexicon-icon-pencil" role="presentation"><use href="${clayIconsUrl}#pencil"></use></svg>`;
						
						editBtn.addEventListener('click', function(e) {
							e.preventDefault();
							if (window.forumsOpenComposeModal) {
								window.forumsOpenComposeModal({
									editMode: true,
									isOp: true,
									threadId: threadId,
									messageId: opMsg.id,
									categoryId: threadCategoryFK,
									subject: threadTitleText,
									body: opMsg.body,
									isQuestion: isThreadQuestion,
									tags: threadTagsArray
								});
							}
						});
						
						opActionsEl.appendChild(editBtn);
					}
					
					/* Use the thread's delete URL for the OP so the whole topic is removed */
					if (threadDeleteUrl) {
						var delBtn = document.createElement('button');
						delBtn.className = 'btn btn-danger btn-sm forums-delete-btn';
						delBtn.setAttribute('data-delete-url', threadDeleteUrl);
						delBtn.setAttribute('title', threadDetail.dataset.labelDeleteTopic || 'Delete Topic');
						delBtn.setAttribute('aria-label', threadDetail.dataset.labelDeleteTopic || 'Delete Topic');
						delBtn.innerHTML = `<svg class="lexicon-icon lexicon-icon-trash" role="presentation"><use href="${clayIconsUrl}#trash"></use></svg>`;
						
						opActionsEl.appendChild(delBtn);
					}
				}

				/* Render OP Toggle Question button if permitted (HATEOAS) */
				var toggleQuestionBtn = threadDetail.querySelector('#forumsDetailToggleQuestionBtn');
				if (toggleQuestionBtn && !isBanned && (canUpdateThread || (opCreatorId && String(opCreatorId) === String(currentUserId)))) {
					toggleQuestionBtn.textContent = isThreadQuestion 
						? (threadDetail.dataset.labelConvertToThread || 'Convert to Thread')
						: (threadDetail.dataset.labelConvertToQuestion || 'Convert to Question');
					toggleQuestionBtn.style.display = '';
					
					var newBtn = toggleQuestionBtn.cloneNode(true);
					toggleQuestionBtn.parentNode.replaceChild(newBtn, toggleQuestionBtn);
					
					newBtn.addEventListener('click', function(e) {
						e.preventDefault();
						var newStatus = !isThreadQuestion;
						
						/* Update the backend object */
						Liferay.Util.fetch(portalURL + '/o/c/forumthreads/' + threadId, {
							headers: headers,
							method: 'PATCH',
							body: JSON.stringify({ question: newStatus })
						})
						.then(function(r) {
							if (r.ok) {
								isThreadQuestion = newStatus;
								
								/* Refresh to show/hide the answer buttons and solved banner */
								loadMessages();
							}
						})
						.catch(function(err) { console.error('Error toggling question status', err); });
					});
				}
			}

			/* Separate solutions from regular replies */
			var solutions = [];
			var regularReplies = [];
			replyMessages.forEach(function(msg) {
				if (isThreadQuestion && msg.answer === true) {
					solutions.push(msg);
					currentAnswerId = msg.id;
				} else {
					regularReplies.push(msg);
				}
			});

			/* Render Solved banner + solution cards */
			if (solutions.length > 0) {
				if (solvedBanner) solvedBanner.style.display = '';
				if (solutionSection) solutionSection.style.display = '';
				if (solutionCount) {
					var tmpl = solutions.length === 1 
						? (threadDetail.dataset.labelAcceptedSolution || '{0} accepted solution')
						: (threadDetail.dataset.labelAcceptedSolutions || '{0} accepted solutions');
					solutionCount.textContent = tmpl.replace('{0}', solutions.length);
				}

				var solHtml = '';
				solutions.forEach(function(sol) {
					solHtml += renderReplyCard(sol, true, 0);
				});
				if (solutionCards) {
					solutionCards.innerHTML = solHtml;
					formatMarkupCodeBlocks(solutionCards);
				}
			}

			/* Render regular replies as a threaded tree */
			var regularReplyCount = totalCount - 1 - solutions.length;
			if (regularReplyCount < 0) regularReplyCount = 0;

			if (regularReplies.length > 0 || regularReplyCount > 0) {
				if (repliesSection) repliesSection.style.display = '';
				if (replyCountEl) {
					var tmpl = regularReplyCount === 1
						? (threadDetail.dataset.labelXReply || '{0} reply')
						: (threadDetail.dataset.labelXReplies || '{0} replies');
					replyCountEl.textContent = tmpl.replace('{0}', regularReplyCount);
				}

				var opId = opMsg ? opMsg.id : 0;
				var repHtml = buildMessageTree(regularReplies, opId);
				if (replyCards) {
					replyCards.innerHTML = repHtml;
					formatMarkupCodeBlocks(replyCards);
				}
			}

			/* Attach all handlers after rendering */
			attachVoteHandlers();
			attachAnswerHandlers();
			attachDeleteHandlers();
			attachEditReplyHandlers();

			/* Scroll to a specific reply when the fragment is on a Forum Reply Display Page */
			if (targetReplyId) {
				var targetCard = threadDetail.querySelector('.forums-thread-detail__reply-card[data-message-id="' + targetReplyId + '"]');
				if (targetCard) {
					setTimeout(function() {
						targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
						targetCard.classList.add('forums-thread-detail__reply-card--targeted');
					}, 200);
				}
			}

			/* Reply pagination */
			if (lastPage > 1 && replyPaginationNav && replyPaginationUl) {
				replyPaginationNav.style.display = '';
				var pageNums = [];
				for (var p = 1; p <= lastPage && p <= 10; p++) pageNums.push(p);

				var pagHtml = `<li class="page-item${currentReplyPage <= 1 ? ' disabled' : ''}"><a class="page-link" href="#" data-page="${currentReplyPage - 1}">&laquo;</a></li>`
					+ pageNums.map(function(p) {
						return `<li class="page-item${p === currentReplyPage ? ' active' : ''}"><a class="page-link" href="#" data-page="${p}">${p}</a></li>`;
					}).join('')
					+ `<li class="page-item${currentReplyPage >= lastPage ? ' disabled' : ''}"><a class="page-link" href="#" data-page="${currentReplyPage + 1}">&raquo;</a></li>`;

				replyPaginationUl.innerHTML = pagHtml;

				replyPaginationUl.querySelectorAll('.page-link').forEach(function(link) {
					link.addEventListener('click', function(e) {
						e.preventDefault();
						var p = parseInt(this.getAttribute('data-page'));
						if (p >= 1) {
							currentReplyPage = p;
							loadMessages();
							repliesSection.scrollIntoView({ behavior: 'smooth' });
						}
					});
				});
			}

			}); /* end fetchUserVotes callback */
		})
		.catch(function(err) {
			if (loadingEl) loadingEl.innerHTML = '<div class="forums-thread-list__empty">' + (threadDetail.dataset.labelUnableToLoadMessages || 'Unable to load messages.') + '</div>';
			console.error('ForumsThreadDetail messages error:', err);
		});
	}

	/* Report Inappropriate Content Modal */
	var reportModalObj = null;

	function showReportModal(onSubmit) {
		var modal = document.getElementById('forumsReportModal');
		if (!modal) {
			modal = document.createElement('div');
			modal.id = 'forumsReportModal';
			modal.className = 'modal';
			modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
			modal.style.zIndex = '1050';
			modal.setAttribute('tabindex', '-1');
			modal.setAttribute('role', 'dialog');
			modal.setAttribute('aria-modal', 'true');
			modal.setAttribute('aria-labelledby', 'forumsReportModalHeading');

			var reasonOptions = [
				{ value: 'spam', label: threadDetail.dataset.labelSpam || 'Spam' },
				{ value: 'harmful-dangerous-acts', label: threadDetail.dataset.labelHarmfulDangerousActs || 'Harmful Dangerous Acts' },
				{ value: 'harassment-bullying', label: threadDetail.dataset.labelHarassmentBullying || 'Harassment or Bullying' },
				{ value: 'nudity-sexual-content', label: threadDetail.dataset.labelNuditySexualContent || 'Nudity or Sexual Content' },
				{ value: 'other', label: threadDetail.dataset.labelOther || 'Other' }
			];

			var optionsHtml = reasonOptions.map(function(opt) {
				return `<option value="${Liferay.Util.escapeHTML(opt.value)}">${Liferay.Util.escapeHTML(opt.label)}</option>`;
			}).join('');

			modal.innerHTML = `
				<div class="modal-dialog modal-dialog-centered">
					<div class="modal-content">
						<div class="modal-header">
							<h1 class="modal-title" id="forumsReportModalHeading" tabindex="-1">${Liferay.Util.escapeHTML(threadDetail.dataset.labelReportInappropriateContent || 'Report Inappropriate Content')}</h1>
							<button class="close btn btn-unstyled forums-report-modal-close" type="button" aria-label="Close">
								<svg class="lexicon-icon lexicon-icon-times" role="presentation">
									<use href="${clayIconsUrl}#times"></use>
								</svg>
							</button>
						</div>
						<div class="modal-body">
							<p class="text-secondary">${Liferay.Util.escapeHTML(threadDetail.dataset.labelReportDescription || 'You are about to report a violation of our Terms of Use. All reports are strictly confidential.')}</p>
							<div class="form-group">
								<label for="forumsReportReason" class="font-weight-bold">${Liferay.Util.escapeHTML(threadDetail.dataset.labelReasonForReport || 'Reason for the Report')}</label>
								<select class="form-control" id="forumsReportReason">
									${optionsHtml}
								</select>
							</div>
						</div>
						<div class="modal-footer">
							<div class="modal-item-last">
								<div class="btn-group-spaced" role="group">
									<button class="btn btn-secondary forums-report-modal-close" type="button">${Liferay.Util.escapeHTML(threadDetail.dataset.labelCancel || 'Cancel')}</button>
									<button class="btn btn-primary" type="button" id="forumsReportModalSubmitBtn">${Liferay.Util.escapeHTML(threadDetail.dataset.labelReport || 'Report')}</button>
								</div>
							</div>
						</div>
					</div>
				</div>`;
			document.body.appendChild(modal);

			modal.querySelectorAll('.forums-report-modal-close').forEach(function(btn) {
				btn.addEventListener('click', function() {
					modal.style.display = 'none';
					modal.classList.remove('show');
				});
			});

			modal.querySelector('#forumsReportModalSubmitBtn').addEventListener('click', function() {
				var reason = modal.querySelector('#forumsReportReason').value;
				var submitBtn = this;
				submitBtn.disabled = true;
				submitBtn.textContent = '...';

				if (reportModalObj && reportModalObj.onSubmit) {
					reportModalObj.onSubmit(reason, function() {
						modal.style.display = 'none';
						modal.classList.remove('show');
						submitBtn.disabled = false;
						submitBtn.textContent = threadDetail.dataset.labelReport || 'Report';
					}, function() {
						submitBtn.disabled = false;
						submitBtn.textContent = threadDetail.dataset.labelReport || 'Report';
					});
				}
			});
		}

		/* Reset dropdown to first option each time the modal is opened */
		var selectEl = modal.querySelector('#forumsReportReason');
		if (selectEl) selectEl.selectedIndex = 0;

		reportModalObj = { onSubmit: onSubmit };

		modal.style.display = 'block';
		setTimeout(function() {
			modal.classList.add('show');
		}, 10);
	}

	/* Flag thread handler */
	if (flagBtn) {
		flagBtn.addEventListener('click', function(e) {
			e.preventDefault();
			/* Already flagged – do nothing */
			if (flagBtn.disabled) return;
			/* Close the options dropdown */
			var optionsMenu = flagBtn.closest('.dropdown-menu');
			if (optionsMenu) optionsMenu.classList.remove('show');

			showReportModal(function(reason, onSuccess, onError) {
				/* addOrUpdate pattern: PATCH if a flag exists, POST if not */
				var flagUrl, flagMethod, flagBody;
				if (existingFlagId) {
					flagUrl = portalURL + '/o/c/forumsuspiciousactivities/' + existingFlagId;
					flagMethod = 'PATCH';
					flagBody = JSON.stringify({ reason: reason });
				} else {
					flagUrl = portalURL + '/o/c/forumsuspiciousactivities/scopes/' + scopeGroupId;
					flagMethod = 'POST';
					flagBody = JSON.stringify({
						reason: reason,
						suspiciousThreadId: parseInt(threadId),
						r_threadSuspiciousActivities_c_forumThreadId: parseInt(threadId)
					});
				}

				Liferay.Util.fetch(flagUrl, {
					headers: headers,
					method: flagMethod,
					body: flagBody
				})
				.then(function(r) {
					if (r.ok) {
						return r.json().then(function(body) {
							existingFlagId = body.id;
							onSuccess();
							flagBtn.textContent = threadDetail.dataset.labelFlagged || 'Flagged';
							flagBtn.classList.add('disabled');
							flagBtn.disabled = true;
							/* Brief toast-like feedback */
							var toast = document.createElement('div');
							toast.className = 'forums-report-toast';
							toast.textContent = threadDetail.dataset.labelReportSubmitted || 'Thank you! Your report has been submitted.';
							threadDetail.prepend(toast);
							setTimeout(function() { toast.classList.add('forums-report-toast--visible'); }, 10);
							setTimeout(function() {
								toast.classList.remove('forums-report-toast--visible');
								setTimeout(function() { toast.remove(); }, 300);
							}, 3000);
						});
					} else {
						onError();
						console.error('Report submission failed');
					}
				})
				.catch(function(err) {
					onError();
					console.error('Report error:', err);
				});
			});
		});
	}

	/* Reply button - open compose modal in reply mode */
	if (replyBtn) {
		replyBtn.addEventListener('click', function() {
			if (typeof window.forumsOpenComposeModal === 'function') {
				window.forumsOpenComposeModal({ threadId: threadId });
			} else {
				alert(threadDetail.dataset.labelReplyFormNotFound || 'Reply form not found on this page. Please add the forums-message-composer fragment.');
			}
		});
	}

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
			initThreadDetail();
		})
		.catch(function(err) {
			console.error('Error checking ban status', err);
			initThreadDetail();
		});
	} else {
		initThreadDetail();
	}
	
	} // end runThreadDetail

	/* Resolve threadId: ?threadId param → mapped reply ERC → mapped thread ERC → URL path slug */
	if (threadId) {
		runThreadDetail(threadId, null);
	} else {
		/* Reply ERC takes priority — set when this fragment is on a Forum Reply Display Page */
		var replyErcEl = threadDetail.querySelector('#forumsDetailReplyERC');
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
				var parentThreadId = reply.r_threadReplies_c_forumThreadId;
				runThreadDetail(parentThreadId ? String(parentThreadId) : null, reply.id ? String(reply.id) : null);
			})
			.catch(function() { runThreadDetail(null, null); });
		} else {
			/* Read ERC from the Display Page-mapped thread element */
			var ercEl = threadDetail.querySelector('#forumsDetailERC');
			var erc = ercEl ? ercEl.textContent.trim() : null;
			if (erc === 'Mappable Thread ERC') erc = null;

			/* Fall back to the slug in the Display Page URL path */
			if (!erc) {
				var pathParts = window.location.pathname.split('/');
				var routeIdx = pathParts.indexOf('-c-forum-topic-');
				erc = routeIdx !== -1 && pathParts[routeIdx + 1] ? decodeURIComponent(pathParts[routeIdx + 1]) : null;
			}

			if (!erc) {
				runThreadDetail(null, null);
			} else {
				Liferay.Util.fetch(portalURL + '/o/c/forumthreads/scopes/' + scopeGroupId + '/by-external-reference-code/' + encodeURIComponent(erc), {
					headers: headers,
					method: 'GET'
				})
				.then(function(r) {
					if (!r.ok) throw new Error('Not found');
					return r.json();
				})
				.then(function(data) {
					runThreadDetail(data.id ? String(data.id) : null, null);
				})
				.catch(function() { runThreadDetail(null, null); });
			}
		}
	}
}
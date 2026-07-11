// SPDX-License-Identifier: LGPL-2.1-or-later

/* ===========================================================================
   Forums Message Detail — SHELL

   This fragment is a style-neutral shell. It owns data + page chrome only:
   bootstrap, messageId/ERC resolution, ban check, the thread/message REST
   layer, and the surrounding chrome (breadcrumb, title, options dropdown,
   banners, skeleton, pagination, topic nav). The original post, solution
   cards, and reply tree are rendered by a SWAPPABLE CHILD fragment dropped
   into the <lfr-drop-zone> (forums-message-detail-standard by default, or
   forums-message-detail-flat). This keeps appearance a matter of composition
   rather than an in-fragment style branch.

   Shell <-> child contract lives on window.forumsMessageDetail:

     window.forumsMessageDetail = {
       payload,              // latest render data (also the cache for late children)
       _subs,               // subscriber fns (a child may register before this shell runs)
       subscribe(fn),       // register + immediately invoke if payload already exists
       notifyRendered(),    // child calls after painting -> shell hides skeleton, runs scrolls
       api: {
         vote(id, dir)          -> Promise<{score, voteValue}|null>
         markAnswer(id, isAnswer)-> Promise
         deleteReply(url, cardEl)-> void   (shell confirms + deletes + removes + reloads)
         helpers: { timeAgo, fullDateTime, renderAvatar, displayName, avatarInitial,
                    avatarColorClass, escapeHTML, formatMarkupCodeBlocks }
       }
     }

   The shell owns REST + vote/answer state; the child owns its own markup and
   repaints from the values the api resolves. Reply/edit reuse the existing
   window.forumsOpenComposeModal channel (see forums-message-composer).
   =========================================================================== */

var messageDetail = fragmentElement.querySelector('#forumsMessageDetail');

if (messageDetail) {
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

	/* ---- shell<->child contract bootstrap. A child fragment may run before or
	   after this shell, so create/augment the shared object defensively and
	   never clobber subscribers a child already registered. ---- */
	var FMD = (window.forumsMessageDetail = window.forumsMessageDetail || {});
	FMD._subs = FMD._subs || [];
	FMD.payload = FMD.payload || null;
	FMD.subscribe = function (fn) {
		FMD._subs.push(fn);
		if (FMD.payload) {
			try { fn(FMD.payload); } catch (e) { console.error('forumsMessageDetail subscriber error', e); }
		}
	};

	/* ---- shell chrome DOM refs (no OP/reply/solution content refs — the child owns those) ---- */
	var titleEl = messageDetail.querySelector('#forumsDetailTitle');
	var loadingEl = messageDetail.querySelector('#forumsDetailLoading');
	var solvedBanner = messageDetail.querySelector('#forumsDetailSolvedBanner');
	var flagBtn = messageDetail.querySelector('#forumsDetailFlagBtn');
	if (flagBtn) flagBtn.style.display = 'none';

	/* "View the Solution" scrolls the child-rendered accepted-solution card into
	   view and flashes its highlight. The card lives in the drop zone, which is
	   inside this shell's subtree, so the query still resolves. */
	var viewSolutionLink = messageDetail.querySelector('#forumsDetailViewSolution');
	if (viewSolutionLink) {
		viewSolutionLink.addEventListener('click', function (e) {
			e.preventDefault();
			var solutionCard = messageDetail.querySelector('.forums-message-detail__reply-card--solution');
			if (!solutionCard) return;
			var controlMenu = document.querySelector('.control-menu-container');
			var offset = (controlMenu ? controlMenu.offsetHeight : 0) + 12;
			var top = solutionCard.getBoundingClientRect().top + window.pageYOffset - offset;
			window.scrollTo({ top: top, behavior: 'smooth' });
			solutionCard.classList.remove('forums-message-detail__reply-card--targeted');
			void solutionCard.offsetWidth;
			solutionCard.classList.add('forums-message-detail__reply-card--targeted');
		});
	}

	var breadcrumbCategory = messageDetail.querySelector('#forumsDetailBreadcrumbCategory');
	var breadcrumbMessage = messageDetail.querySelector('#forumsDetailBreadcrumbMessage');
	var allTopicsLink = messageDetail.querySelector('#forumsDetailAllTopics');
	var categoryLink = messageDetail.querySelector('#forumsDetailCategoryLink');

	if (allTopicsLink) {
		allTopicsLink.href = sitePrefix + ((typeof configuration !== 'undefined' && configuration.communityURL) ? configuration.communityURL : '/forums');
	}

	var communityBreadcrumb = messageDetail.querySelector('#forumsDetailBreadcrumb li:first-child a');
	if (communityBreadcrumb) {
		communityBreadcrumb.href = sitePrefix + ((typeof configuration !== 'undefined' && configuration.communityURL) ? configuration.communityURL : '/forums');
	}
	var replyPaginationNav = messageDetail.querySelector('#forumsDetailReplyPagination');
	var replyPaginationUl = messageDetail.querySelector('#forumsDetailReplyPaginationUl');

	/* URL params */
	var urlParams = new URLSearchParams(window.location.search);
	var messageId = urlParams.get('messageId');

	/* Options Dropdown Vanilla JS Fallback */
	var optionsBtn = messageDetail.querySelector('#forumsDetailOptions');
	if (optionsBtn && Liferay.ThemeDisplay.isSignedIn()) {
		var optionsDropdown = messageDetail.querySelector('#forumsDetailOptionsDropdown');
		if (optionsDropdown) optionsDropdown.style.display = '';
		var optionsMenu = optionsBtn.nextElementSibling;
		optionsBtn.addEventListener('click', function (e) {
			e.preventDefault();
			if (optionsMenu) {
				var expanded = optionsMenu.classList.toggle('show');
				optionsBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
			}
		});
		document.addEventListener('click', function (e) {
			if (optionsMenu && !optionsBtn.contains(e.target) && !optionsMenu.contains(e.target)) {
				optionsMenu.classList.remove('show');
				optionsBtn.setAttribute('aria-expanded', 'false');
			}
		});
		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape' && optionsMenu && optionsMenu.classList.contains('show')) {
				optionsMenu.classList.remove('show');
				optionsBtn.setAttribute('aria-expanded', 'false');
				optionsBtn.focus();
			}
		});
	}

	/* ---- Shared helpers (exposed to the child via api.helpers) ---- */
	function indentHtmlText(text) {
		var voidTag = /^<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)(\s|>|\/)/i;
		var pad = '  ';
		var indent = 0;
		return text.split('\n').map(function (line) {
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
		container.querySelectorAll('pre code').forEach(function (codeEl) {
			var text = codeEl.textContent;
			if (text.indexOf('\n') === -1 && text.indexOf('> <') !== -1) {
				text = text.replace(/>\s+</g, '>\n<');
				text = indentHtmlText(text);
				codeEl.textContent = text;
			}
		});
	}

	function timeAgo(dateStr) {
		if (!dateStr) return '';
		var now = Date.now();
		var then = new Date(dateStr).getTime();
		var diff = Math.floor((now - then) / 1000);
		if (diff < 60) return messageDetail.dataset.labelJustNow || 'just now';
		if (diff < 3600) return (messageDetail.dataset.labelXMinutesAgo || '{0}m ago').replace('{0}', Math.floor(diff / 60));
		if (diff < 86400) return (messageDetail.dataset.labelXHoursAgo || '{0}h ago').replace('{0}', Math.floor(diff / 3600));
		if (diff < 2592000) return (messageDetail.dataset.labelXDaysAgo || '{0}d ago').replace('{0}', Math.floor(diff / 86400));
		return new Date(dateStr).toLocaleDateString();
	}

	function fullDateTime(dateStr) {
		if (!dateStr) return '';
		return new Date(dateStr).toLocaleString(undefined, {
			year: 'numeric', month: '2-digit', day: '2-digit',
			hour: '2-digit', minute: '2-digit', second: '2-digit'
		});
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

	function avatarColorClass(creator) {
		var key = String((creator && (creator.id || creator.name)) || '');
		var n = 0;
		for (var i = 0; i < key.length; i++) { n = (n + key.charCodeAt(i)) % 10; }
		return 'sticker-outline-' + n;
	}

	function renderAvatar(creator, size) {
		var sizeClass = size === 'sm' ? 'sticker-sm' : 'sticker-lg';
		var baseCls = 'sticker sticker-circle ' + sizeClass;
		if (creator && creator.image) {
			return '<span class="' + baseCls + '"><span class="sticker-overlay"><img class="sticker-img" src="' + Liferay.Util.escapeHTML(creator.image) + '" alt="' + Liferay.Util.escapeHTML(displayName(creator)) + '"></span></span>';
		}
		var name = displayName(creator);
		return '<span class="' + baseCls + ' ' + avatarColorClass(creator) + '"><span class="sticker-overlay">' + avatarInitial(name) + '</span></span>';
	}

	var sharedHelpers = {
		timeAgo: timeAgo,
		fullDateTime: fullDateTime,
		renderAvatar: renderAvatar,
		displayName: displayName,
		avatarInitial: avatarInitial,
		avatarColorClass: avatarColorClass,
		escapeHTML: Liferay.Util.escapeHTML,
		formatMarkupCodeBlocks: formatMarkupCodeBlocks
	};

	function runMessageDetail(resolvedMessageId, replyId) {
		messageId = resolvedMessageId;
		var targetReplyId = replyId || null;
		var skeletonShownAt = Date.now();
		if (!messageId) {
			if (loadingEl) loadingEl.innerHTML = '<div class="forums-message-list__empty text-secondary text-center py-5">' + (messageDetail.dataset.labelNoMessage || 'No message selected.') + '</div>';
			return;
		}

		var replyPageSize = parseInt((typeof configuration !== 'undefined' && configuration.repliesPageSize) || '10', 10) || 10;
		var currentReplyPage = 1;
		var newViewCount = 0;
		var isBanned = false;

		/* Thread + reply state */
		var userVoteMap = {};
		var voteScoreMap = {};       /* messageId -> authoritative vote score (shell-owned) */
		var opMsg = null;
		var opCreatorId = null;
		var opAuthorName = '';
		var currentAnswerId = null;
		var messageDeleteUrl = null;
		var canUpdateMessage = false;
		var canVote = false;
		var canReply = false;
		var isMessageQuestion = false;
		var messageCategoryFK = null;
		var messageTitleText = '';
		var messageTagsArray = [];
		var replyMessagesMap = {};
		var existingFlagId = null;

		/* ---- render-completion handshake + watchdog ---- */
		var renderedFired = false;
		var watchdogTimer = null;

		function hideSkeleton() {
			if (!loadingEl) return;
			var elapsed = Date.now() - skeletonShownAt;
			var remainingMs = Math.max(0, 600 - elapsed);
			setTimeout(function () {
				loadingEl.classList.add('forums-skeleton--fade-out');
				setTimeout(function () {
					loadingEl.style.display = 'none';
					loadingEl.removeAttribute('aria-busy');
					loadingEl.classList.remove('forums-skeleton--fade-out');
				}, 250);
			}, remainingMs);
		}

		function runPostRender() {
			if (targetReplyId) {
				var targetCard = messageDetail.querySelector('.forums-message-detail__reply-card[data-message-id="' + targetReplyId + '"]');
				if (targetCard) {
					setTimeout(function () {
						targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
						targetCard.classList.add('forums-message-detail__reply-card--targeted');
					}, 200);
				}
			}
		}

		/* No child ever painted (empty or mis-swapped drop zone): stop the
		   skeleton from spinning forever and surface an error instead. */
		function showChildMissingError() {
			if (loadingEl) {
				loadingEl.classList.remove('forums-skeleton--fade-out');
				loadingEl.style.display = '';
				loadingEl.setAttribute('aria-busy', 'false');
				loadingEl.innerHTML = '<div class="forums-message-list__empty text-secondary text-center py-5">' + (messageDetail.dataset.labelUnableToLoadMessages || 'Unable to load messages.') + '</div>';
			}
		}

		FMD.notifyRendered = function () {
			renderedFired = true;
			if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null; }
			hideSkeleton();
			runPostRender();
		};

		function publish(payload) {
			FMD.payload = payload;
			renderedFired = false;
			if (watchdogTimer) clearTimeout(watchdogTimer);
			watchdogTimer = setTimeout(function () {
				if (!renderedFired) showChildMissingError();
			}, 8000);
			FMD._subs.forEach(function (fn) {
				try { fn(payload); } catch (e) { console.error('forumsMessageDetail subscriber error', e); }
			});
		}

		/* ---- sort + tree (structure only; the child renders it) ---- */
		function sortByVoteScore(messages) {
			return messages.slice().sort(function (a, b) {
				var aAnswer = isMessageQuestion && a.answer === true ? 1 : 0;
				var bAnswer = isMessageQuestion && b.answer === true ? 1 : 0;
				if (bAnswer !== aAnswer) return bAnswer - aAnswer;
				var aScore = a.voteScore || 0;
				var bScore = b.voteScore || 0;
				if (bScore !== aScore) return bScore - aScore;
				return new Date(a.dateCreated) - new Date(b.dateCreated);
			});
		}

		/* Build a flattened, ordered list of { msg, depth, isSolution } from flat
		   messages using parentMessageId. Returns data, NOT HTML — the child owns
		   markup. */
		function buildMessageTree(messages, opId) {
			var childrenMap = {};
			var messageIds = {};

			messages.forEach(function (msg) { messageIds[msg.id] = true; });

			messages.forEach(function (msg) {
				var parentId = msg.parentMessageId || 0;
				if (parentId !== 0 && parentId !== opId && !messageIds[parentId]) {
					parentId = opId;
				}
				if (!childrenMap[parentId]) childrenMap[parentId] = [];
				childrenMap[parentId].push(msg);
			});

			var topLevel = (childrenMap[0] || []).concat(childrenMap[opId] || []);
			if (opId === 0) {
				topLevel = childrenMap[0] || [];
			}
			topLevel = sortByVoteScore(topLevel);

			var out = [];
			(function walk(list, depth) {
				list.forEach(function (msg) {
					out.push({ msg: msg, depth: depth, isSolution: isMessageQuestion && msg.answer === true });
					var children = childrenMap[msg.id];
					if (children && children.length > 0) walk(sortByVoteScore(children), depth + 1);
				});
			})(topLevel, 0);
			return out;
		}

		/* ---- votes (REST + state owned by the shell) ---- */
		function fetchUserVotes(messageIds, callback) {
			if (!messageIds || messageIds.length === 0) { callback(); return; }
			if (!Liferay.ThemeDisplay.isSignedIn()) { callback(); return; }
			var filterParam = encodeURIComponent('creatorId eq ' + currentUserId);
			Liferay.Util.fetch(portalURL + '/o/c/forumvotes/scopes/' + scopeGroupId + '?filter=' + filterParam + '&pageSize=200', {
				headers: headers,
				method: 'GET'
			})
			.then(function (r) { return r.json(); })
			.then(function (data) {
				if (!isBanned && data.actions && (data.actions['POST'] || data.actions['post'] || data.actions['create'])) {
					canVote = true;
				} else if (!isBanned && canReply) {
					canVote = true;
				}
				var items = data.items || [];
				userVoteMap = {};
				var messageIdSet = {};
				messageIds.forEach(function (id) { messageIdSet[id] = true; });
				items.forEach(function (vote) {
					var msgId = vote.r_messageVotes_c_forumMessageId;
					if (msgId && messageIdSet[msgId]) {
						userVoteMap[msgId] = { voteId: vote.id, voteValue: vote.voteValue };
					}
				});
				callback();
			})
			.catch(function () { callback(); });
		}

		function createVote(messageId, voteValue) {
			return Liferay.Util.fetch(portalURL + '/o/c/forumvotes/scopes/' + scopeGroupId, {
				headers: headers,
				method: 'POST',
				body: JSON.stringify({
					voteValue: voteValue,
					r_messageVotes_c_forumMessageId: messageId
				})
			})
			.then(function (r) { return r.json(); })
			.then(function (vote) {
				userVoteMap[messageId] = { voteId: vote.id, voteValue: voteValue };
			});
		}

		function deleteVote(voteId) {
			return Liferay.Util.fetch(portalURL + '/o/c/forumvotes/' + voteId, {
				headers: headers,
				method: 'DELETE'
			});
		}

		function persistVoteScore(messageId, score) {
			Liferay.Util.fetch(portalURL + '/o/c/forummessages/' + messageId, {
				headers: headers,
				method: 'PATCH',
				body: JSON.stringify({ voteScore: score })
			}).catch(function (err) { console.error('Score persist error:', err); });
		}

		/* api.vote: perform the vote REST, mutate shell state, resolve with the new
		   { score, voteValue } so the child repaints its own buttons. voteValue is
		   0 when the vote was toggled off. */
		function apiVote(messageId, direction) {
			if (!canVote) return Promise.resolve(null);
			var voteValue = direction === 'up' ? 1 : -1;
			var existing = userVoteMap[messageId];
			var chain, delta, finalVoteValue;

			if (existing) {
				if (existing.voteValue === voteValue) {
					chain = deleteVote(existing.voteId).then(function () { delete userVoteMap[messageId]; });
					delta = -voteValue;
					finalVoteValue = 0;
				} else {
					chain = deleteVote(existing.voteId).then(function () { return createVote(messageId, voteValue); });
					delta = voteValue * 2;
					finalVoteValue = voteValue;
				}
			} else {
				chain = createVote(messageId, voteValue);
				delta = voteValue;
				finalVoteValue = voteValue;
			}

			return chain.then(function () {
				var newScore = (voteScoreMap[messageId] || 0) + delta;
				voteScoreMap[messageId] = newScore;
				persistVoteScore(messageId, newScore);
				return { score: newScore, voteValue: finalVoteValue };
			}).catch(function (err) {
				console.error('Vote error:', err);
				return null;
			});
		}

		/* api.markAnswer: mark/unmark a reply as the accepted answer; shell schedules
		   a reload so every card re-renders with the new accepted state. */
		function apiMarkAnswer(messageId, isCurrentlyAnswer) {
			if (isCurrentlyAnswer) {
				return Liferay.Util.fetch(portalURL + '/o/c/forummessages/' + messageId, {
					headers: headers,
					method: 'PATCH',
					body: JSON.stringify({ answer: false })
				})
				.then(function (r) {
					if (r.ok) {
						currentAnswerId = null;
						setTimeout(loadMessages, 1500);
					}
				})
				.catch(function (err) { console.error('Unmark answer error:', err); });
			}
			var chain = Promise.resolve();
			if (currentAnswerId && currentAnswerId !== messageId) {
				chain = Liferay.Util.fetch(portalURL + '/o/c/forummessages/' + currentAnswerId, {
					headers: headers,
					method: 'PATCH',
					body: JSON.stringify({ answer: false })
				});
			}
			return chain.then(function () {
				return Liferay.Util.fetch(portalURL + '/o/c/forummessages/' + messageId, {
					headers: headers,
					method: 'PATCH',
					body: JSON.stringify({ answer: true })
				});
			})
			.then(function (r) {
				if (r.ok) {
					currentAnswerId = messageId;
					setTimeout(loadMessages, 1500);
				}
			})
			.catch(function (err) { console.error('Mark answer error:', err); });
		}

		/* api.deleteReply: shell confirms, deletes, optimistically removes the
		   child's card (handed in explicitly), then reloads. */
		function apiDeleteReply(deleteUrl, cardEl) {
			var title = messageDetail.dataset.labelDeleteReply || 'Delete Reply';
			var confirmMsg = messageDetail.dataset.labelConfirmDeleteReply || 'Deleting a reply is an action impossible to revert. It will not be possible to recover it.';
			showDeleteModal(title, confirmMsg, function () {
				Liferay.Util.fetch(deleteUrl, {
					headers: headers,
					method: 'DELETE'
				})
				.then(function (r) {
					if (r.ok) {
						if (cardEl) {
							cardEl.style.opacity = '0.5';
							setTimeout(function () { cardEl.remove(); }, 300);
						}
						setTimeout(loadMessages, 1500);
					} else {
						console.error('Failed to delete reply');
					}
				})
				.catch(function (err) { console.error('Delete reply error:', err); });
			});
		}

		/* OP / topic delete lives in the shell's options dropdown (chrome). Bound
		   directly to the dropdown button — reply deletes are handled by the child
		   via api.deleteReply, so there is no shared cross-boundary sweep. */
		function attachOpDeleteHandler() {
			var opDeleteBtn = messageDetail.querySelector('#forumsDetailDeleteBtn');
			if (!opDeleteBtn) return;
			var newBtn = opDeleteBtn.cloneNode(true);
			opDeleteBtn.parentNode.replaceChild(newBtn, opDeleteBtn);
			newBtn.addEventListener('click', function (e) {
				e.preventDefault();
				var deleteUrl = this.getAttribute('data-delete-url');
				if (!deleteUrl) return;
				var title = messageDetail.dataset.labelDeleteTopic || 'Delete Topic';
				var confirmMsg = messageDetail.dataset.labelConfirmDeleteTopic || 'Deleting a topic is an action impossible to revert. All the replies in the topic will be removed and it will not be possible to recover them.';
				showDeleteModal(title, confirmMsg, function () {
					Liferay.Util.fetch(deleteUrl, {
						headers: headers,
						method: 'DELETE'
					})
					.then(function (r) {
						if (r.ok) {
							var breadcrumbCatEl = messageDetail.querySelector('#forumsDetailBreadcrumbCategory');
							var messagesBase = sitePrefix + ((typeof configuration !== 'undefined' && configuration.messagesURL) ? configuration.messagesURL : '/forums-messages');
							var targetHref = (breadcrumbCatEl && breadcrumbCatEl.href) ? breadcrumbCatEl.href
								: (messageCategoryFK ? messagesBase + '?categoryId=' + messageCategoryFK : messagesBase);
							setTimeout(function () { window.location.href = targetHref; }, 1500);
						} else {
							console.error('Failed to delete topic');
						}
					})
					.catch(function (err) { console.error('Delete topic error:', err); });
				});
			});
		}

		/* ---- the api object handed to children ---- */
		FMD.api = {
			vote: apiVote,
			markAnswer: apiMarkAnswer,
			deleteReply: apiDeleteReply,
			helpers: sharedHelpers
		};

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
									<button class="btn btn-secondary forums-delete-modal-close" type="button">${messageDetail.dataset.labelCancel || 'Cancel'}</button>
									<button class="btn btn-danger" type="button" id="forumsDeleteModalConfirmBtn">${messageDetail.dataset.labelDelete || 'Delete'}</button>
								</div>
							</div>
						</div>
					</div>
				</div>`;
				document.body.appendChild(modal);

				modal.querySelectorAll('.forums-delete-modal-close').forEach(function (btn) {
					btn.addEventListener('click', function () {
						modal.style.display = 'none';
						modal.classList.remove('show');
						if (deleteModalObj && deleteModalObj.onCancel) {
							deleteModalObj.onCancel();
						}
					});
				});

				modal.querySelector('#forumsDeleteModalConfirmBtn').addEventListener('click', function () {
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
			setTimeout(function () {
				modal.classList.add('show');
			}, 10);
		}

		/* Load thread data */
		function initMessageDetail() {
			if (isBanned) {
				var bannedBanner = document.createElement('div');
				bannedBanner.className = 'alert alert-danger mt-3';
				bannedBanner.setAttribute('role', 'alert');
				bannedBanner.innerHTML = `<span class="alert-indicator"><svg class="lexicon-icon lexicon-icon-warning-full" role="presentation" viewBox="0 0 16 16" fill="currentColor"><path d="M16 14.5L8 1 0 14.5h16zM8 13c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm1-3H7V6h2v4z"/></svg></span><strong class="lead">${messageDetail.dataset.labelBanned || 'Banned'}: </strong>${messageDetail.dataset.labelBannedWarning || 'Your account has been banned from participating in the forums.'}`;

				var titleRow = messageDetail.querySelector('.forums-message-detail__title-row');
				if (titleRow) {
					titleRow.parentNode.insertBefore(bannedBanner, titleRow);
				}
			}

			Liferay.Util.fetch(portalURL + '/o/c/forumthreads/' + messageId + '?nestedFields=threadSuspiciousActivities', {
				headers: headers,
				method: 'GET'
			})
			.then(function (r) { return r.json(); })
			.then(function (msg) {
				if (isBanned) {
					if (msg.actions) msg.actions = {};
					if (optionsBtn) optionsBtn.style.display = 'none';
				}

				if (msg.actions && msg.actions['delete']) {
					messageDeleteUrl = msg.actions['delete'].href;
				}
				if (msg.actions && (msg.actions['update'] || msg.actions['patch'] || msg.actions['PUT'])) {
					canUpdateMessage = true;
				}

				var subscribeBtn = messageDetail.querySelector('#forumsDetailSubscribeBtn');
				var currentSubscribeUrl = null;
				var isSubscribed = false;

				if (subscribeBtn && msg.actions && !isBanned) {
					if (msg.actions['unsubscribe']) {
						currentSubscribeUrl = msg.actions['unsubscribe'].href;
						isSubscribed = true;
					} else if (msg.actions['subscribe']) {
						currentSubscribeUrl = msg.actions['subscribe'].href;
						isSubscribed = false;
					}

					if (currentSubscribeUrl) {
						subscribeBtn.textContent = isSubscribed
							? (messageDetail.dataset.labelUnsubscribe || 'Unsubscribe')
							: (messageDetail.dataset.labelSubscribe || 'Subscribe');
						subscribeBtn.style.display = '';

						var newSubBtn = subscribeBtn.cloneNode(true);
						subscribeBtn.parentNode.replaceChild(newSubBtn, subscribeBtn);
						subscribeBtn = newSubBtn;

						subscribeBtn.addEventListener('click', function (e) {
							e.preventDefault();
							var btn = this;
							btn.style.opacity = '0.5';
							btn.style.pointerEvents = 'none';

							Liferay.Util.fetch(currentSubscribeUrl, {
								headers: headers,
								method: 'POST'
							})
							.then(function (r) {
								if (r.ok) {
									isSubscribed = !isSubscribed;
									currentSubscribeUrl = isSubscribed
										? currentSubscribeUrl.replace('/subscribe', '/unsubscribe')
										: currentSubscribeUrl.replace('/unsubscribe', '/subscribe');

									btn.textContent = isSubscribed
										? (messageDetail.dataset.labelUnsubscribe || 'Unsubscribe')
										: (messageDetail.dataset.labelSubscribe || 'Subscribe');

									var optionsMenu = btn.closest('.dropdown-menu');
									if (optionsMenu) optionsMenu.classList.remove('show');

									if (Liferay.Util && Liferay.Util.openToast) {
										var toastMsg = isSubscribed
											? (messageDetail.dataset.labelSubscribedToast || 'You have been subscribed to this message.')
											: (messageDetail.dataset.labelUnsubscribedToast || 'You have been unsubscribed from this message.');
										Liferay.Util.openToast({
											message: toastMsg,
											title: messageDetail.dataset.labelSuccess || 'Success',
											type: 'success'
										});
									}
								}
							})
							.catch(function (err) { console.error('Subscription error:', err); })
							.finally(function () {
								btn.style.opacity = '1';
								btn.style.pointerEvents = '';
							});
						});
					}
				}

				/* Increment viewCount via REST PATCH (unique per session) */
				var currentViewCount = msg.viewCount;
				currentViewCount = currentViewCount || 0;
				var viewStorageKey = 'forums_viewed_' + currentUserId + '_' + messageId;
				var alreadyViewed = false;
				try { alreadyViewed = !!sessionStorage.getItem(viewStorageKey); } catch (e) {}

				if (!alreadyViewed && Liferay.ThemeDisplay.isSignedIn()) {
					newViewCount = currentViewCount + 1;
					Liferay.Util.fetch(portalURL + '/o/c/forumthreads/' + messageId, {
						method: 'PATCH',
						headers: headers,
						body: JSON.stringify({ viewCount: newViewCount })
					}).then(function (r) {
						return r.json().then(function (body) {
							if (r.ok) {
								try { sessionStorage.setItem(viewStorageKey, '1'); } catch (e) {}
							} else {
								console.error('View count update failed:', r.status, body);
							}
						});
					}).catch(function (err) { console.error('View count update error:', err); });
				} else {
					newViewCount = currentViewCount;
				}

				isMessageQuestion = msg.question === true;

				var isFlagged = false;
				var suspiciousActivities = msg.threadSuspiciousActivities || [];
				for (var s = 0; s < suspiciousActivities.length; s++) {
					if (suspiciousActivities[s].validated === true) {
						isFlagged = true;
						break;
					}
				}

				if (isFlagged) {
					var flaggedBanner = messageDetail.querySelector('#forumsDetailFlaggedBanner');
					if (!flaggedBanner) {
						flaggedBanner = document.createElement('div');
						flaggedBanner.id = 'forumsDetailFlaggedBanner';
						flaggedBanner.className = 'alert alert-danger mt-3';
						flaggedBanner.setAttribute('role', 'alert');
						flaggedBanner.innerHTML = `<span class="alert-indicator"><svg class="lexicon-icon lexicon-icon-warning-full" role="presentation" viewBox="0 0 16 16" fill="currentColor"><path d="M16 14.5L8 1 0 14.5h16zM8 13c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm1-3H7V6h2v4z"/></svg></span><strong class="lead">${messageDetail.dataset.labelFlagged || 'Flagged'}: </strong>${messageDetail.dataset.labelFlaggedWarning || 'This message has been flagged and validated by moderators as inappropriate content.'}`;

						var titleRow = messageDetail.querySelector('.forums-message-detail__title-row');
						if (titleRow) {
							titleRow.parentNode.insertBefore(flaggedBanner, titleRow.nextSibling);
						}
					} else {
						flaggedBanner.style.display = '';
					}
				}

				messageTitleText = msg.messageTitle || messageDetail.dataset.labelUntitledMessage || 'Untitled Message';
				messageCategoryFK = msg.r_categoryThreads_c_forumCategoryId;
				messageTagsArray = msg.keywords || [];
				var title = messageTitleText;
				var categoryFK = messageCategoryFK;

				if (titleEl) titleEl.textContent = title;
				if (breadcrumbMessage) breadcrumbMessage.textContent = title;

				if (categoryFK) {
					Liferay.Util.fetch(portalURL + '/o/c/forumcategories/' + categoryFK, {
						headers: headers,
						method: 'GET'
					})
					.then(function (r) { return r.json(); })
					.then(function (cat) {
						var catName = cat.categoryName || messageDetail.dataset.labelCategory || 'Category';
						var messagesHref = sitePrefix + ((typeof configuration !== 'undefined' && configuration.messagesURL) ? configuration.messagesURL : '/forums-messages');
						var catURL = messagesHref + '?categoryId=' + categoryFK;

						if (breadcrumbCategory) {
							breadcrumbCategory.textContent = catName;
							breadcrumbCategory.href = catURL;
						}

						if (categoryLink) {
							var labelText = (messageDetail.dataset.labelBackToX || 'Back to {0}').replace('{0}', catName);
							categoryLink.textContent = labelText;
							categoryLink.href = catURL;
							categoryLink.style.display = '';
						}
					})
					.catch(function () {});
				}

				if (flagBtn && currentUserId) {
					Liferay.Util.fetch(portalURL + '/o/c/forumsuspiciousactivities/scopes/' + scopeGroupId + '?filter='
						+ encodeURIComponent('creatorId eq ' + currentUserId + ' and suspiciousMessageId eq ' + messageId)
						+ '&pageSize=1', {
						headers: headers,
						method: 'GET'
					})
					.then(function (r) { return r.json(); })
					.then(function (data) {
						var items = data.items || [];
						if (items.length > 0) {
							existingFlagId = items[0].id;
							flagBtn.textContent = messageDetail.dataset.labelFlagged || 'Flagged';
							flagBtn.classList.add('disabled');
							flagBtn.disabled = true;
						}
					})
					.catch(function (err) { console.error('Flag dedup check error:', err); });
				}

				loadMessages();
			})
			.catch(function (err) {
				if (loadingEl) loadingEl.innerHTML = '<div class="forums-message-list__empty text-secondary text-center py-5">' + (messageDetail.dataset.labelUnableToLoadMessage || 'Unable to load message.') + '</div>';
				console.error('ForumsMessageDetail error:', err);
			});
		}

		/* Load messages, assemble the render payload, and publish to the child. */
		function loadMessages() {
			if (loadingEl) {
				loadingEl.classList.remove('forums-skeleton--fade-out');
				loadingEl.style.display = '';
				loadingEl.setAttribute('aria-busy', 'true');
				skeletonShownAt = Date.now();
			}

			Liferay.Util.fetch(portalURL + '/o/c/forummessages/scopes/' + scopeGroupId + '?filter='
				+ encodeURIComponent('r_threadMessages_c_forumThreadId eq \'' + messageId + '\'')
				+ '&sort=dateCreated:asc&page=' + currentReplyPage
				+ '&pageSize=' + replyPageSize, {
				headers: headers,
				method: 'GET'
			})
			.then(function (r) { return r.json(); })
			.then(function (data) {
				var messages = data.items || [];
				var totalCount = data.totalCount || 0;
				var lastPage = data.lastPage || 1;

				if (messages.length === 0) {
					if (loadingEl) { loadingEl.style.display = 'none'; loadingEl.removeAttribute('aria-busy'); }
					return;
				}

				if (isBanned) {
					messages.forEach(function (msg) { msg.actions = {}; });
				}

				/* HATEOAS: can this user reply? (also drives the shell flag button
				   and the child's reply affordances via the payload) */
				if (!isBanned && data.actions && (data.actions['POST'] || data.actions['post'] || data.actions['create'])) {
					canReply = true;
					if (flagBtn) flagBtn.style.display = '';
				}

				var allMsgIds = messages.map(function (m) { return m.id; });
				messages.forEach(function (m) { voteScoreMap[m.id] = m.voteScore || 0; });

				fetchUserVotes(allMsgIds, function () {
					/* Separate OP (first message on page 1) from replies */
					opMsg = null;
					var replyMessages = [];
					messages.forEach(function (msg, idx) {
						replyMessagesMap[msg.id] = msg;
						if (currentReplyPage === 1 && idx === 0) {
							opMsg = msg;
						} else {
							replyMessages.push(msg);
						}
					});

					if (opMsg) {
						var creator = opMsg.creator || {};
						opCreatorId = creator.id || null;
						opAuthorName = displayName(creator) || messageDetail.dataset.labelUnknown || 'Unknown';
						wireOpChromeActions();
					}

					/* Separate solutions from regular replies; reset the tracked
					   accepted-answer id so a stale value can't leak in. */
					var solutions = [];
					var regularReplies = [];
					currentAnswerId = null;
					replyMessages.forEach(function (msg) {
						if (isMessageQuestion && msg.answer === true) {
							solutions.push(msg);
							currentAnswerId = msg.id;
						} else {
							regularReplies.push(msg);
						}
					});

					/* Solved banner is shell chrome (its "view the solution" link
					   scrolls to the child-rendered solution card). Toggle it here. */
					if (solvedBanner) solvedBanner.style.display = solutions.length > 0 ? '' : 'none';

					var regularReplyCount = totalCount - 1 - solutions.length;
					if (regularReplyCount < 0) regularReplyCount = 0;

					var opId = opMsg ? opMsg.id : 0;
					var replyTree = buildMessageTree(regularReplies, opId);

					/* Publish the render payload to the child. */
					publish({
						messageId: messageId,
						op: opMsg,
						solutions: solutions,
						replyTree: replyTree,
						regularReplyCount: regularReplyCount,
						isQuestion: isMessageQuestion,
						opCreatorId: opCreatorId,
						opAuthorName: opAuthorName,
						currentAnswerId: currentAnswerId,
						canVote: canVote,
						canReply: canReply,
						canUpdateMessage: canUpdateMessage,
						currentUserId: currentUserId,
						userVoteMap: userVoteMap,
						messageTagsArray: messageTagsArray,
						clayIconsUrl: clayIconsUrl,
						config: (typeof configuration !== 'undefined' ? configuration : {}),
						api: FMD.api
					});

					renderPagination(lastPage);
				});
			})
			.catch(function (err) {
				if (loadingEl) loadingEl.innerHTML = '<div class="forums-message-list__empty text-secondary text-center py-5">' + (messageDetail.dataset.labelUnableToLoadMessages || 'Unable to load messages.') + '</div>';
				console.error('ForumsMessageDetail messages error:', err);
			});
		}

		/* Wire the OP/topic-level actions that live in the shell's options dropdown
		   (edit topic, delete topic, convert to question). Fed entirely from shell
		   state (opMsg + thread flags), never from the child's DOM. */
		function wireOpChromeActions() {
			var dropdownEditBtn = messageDetail.querySelector('#forumsDetailEditBtn');
			if (dropdownEditBtn && canUpdateMessage) {
				dropdownEditBtn.style.display = '';
				var newDropdownEditBtn = dropdownEditBtn.cloneNode(true);
				dropdownEditBtn.parentNode.replaceChild(newDropdownEditBtn, dropdownEditBtn);
				newDropdownEditBtn.addEventListener('click', function (e) {
					e.preventDefault();
					if (window.forumsOpenComposeModal) {
						window.forumsOpenComposeModal({
							editMode: true,
							isOp: true,
							threadId: messageId,
							messageId: opMsg.id,
							categoryId: messageCategoryFK,
							subject: messageTitleText,
							body: opMsg.body,
							isQuestion: isMessageQuestion,
							tags: messageTagsArray
						});
					}
				});
			}

			var dropdownDeleteBtn = messageDetail.querySelector('#forumsDetailDeleteBtn');
			if (dropdownDeleteBtn && messageDeleteUrl) {
				dropdownDeleteBtn.setAttribute('data-delete-url', messageDeleteUrl);
				dropdownDeleteBtn.style.display = '';
				attachOpDeleteHandler();
			}

			var toggleQuestionBtn = messageDetail.querySelector('#forumsDetailToggleQuestionBtn');
			if (toggleQuestionBtn && !isBanned && (canUpdateMessage || (opCreatorId && String(opCreatorId) === String(currentUserId)))) {
				toggleQuestionBtn.textContent = isMessageQuestion
					? (messageDetail.dataset.labelConvertToMessage || 'Convert to Discussion')
					: (messageDetail.dataset.labelConvertToQuestion || 'Convert to Question');
				toggleQuestionBtn.style.display = '';

				var newBtn = toggleQuestionBtn.cloneNode(true);
				toggleQuestionBtn.parentNode.replaceChild(newBtn, toggleQuestionBtn);

				newBtn.addEventListener('click', function (e) {
					e.preventDefault();
					var newStatus = !isMessageQuestion;

					/* Demoting a question to a discussion: clear the answer flag on
					   every reply first (across all pages), else stale answers remain. */
					var preWork = newStatus
						? Promise.resolve()
						: Liferay.Util.fetch(portalURL + '/o/c/forummessages/scopes/' + scopeGroupId
								+ '?filter=' + encodeURIComponent('r_threadMessages_c_forumThreadId eq \'' + messageId + '\' and answer eq true')
								+ '&fields=id&pageSize=100', {
								headers: headers,
								method: 'GET'
							})
							.then(function (r) { return r.json(); })
							.then(function (data) {
								var items = (data && data.items) || [];
								return Promise.all(items.map(function (reply) {
									return Liferay.Util.fetch(portalURL + '/o/c/forummessages/' + reply.id, {
										headers: headers,
										method: 'PATCH',
										body: JSON.stringify({ answer: false })
									});
								}));
							});

					preWork
						.then(function () {
							return Liferay.Util.fetch(portalURL + '/o/c/forumthreads/' + messageId, {
								headers: headers,
								method: 'PATCH',
								body: JSON.stringify({ question: newStatus })
							});
						})
						.then(function (r) {
							if (r.ok) {
								isMessageQuestion = newStatus;
								if (!newStatus) currentAnswerId = null;
								loadMessages();
							}
						})
						.catch(function (err) { console.error('Error toggling question status', err); });
				});
			}
		}

		/* Reply pagination (shell chrome). Page change re-fetches + re-publishes. */
		function renderPagination(lastPage) {
			if (!(lastPage > 1 && replyPaginationNav && replyPaginationUl)) {
				if (replyPaginationNav) replyPaginationNav.style.display = 'none';
				return;
			}
			replyPaginationNav.style.display = '';
			var pageNums = [];
			for (var p = 1; p <= lastPage && p <= 10; p++) pageNums.push(p);

			var pagHtml = `<li class="page-item${currentReplyPage <= 1 ? ' disabled' : ''}"><a class="page-link" href="#" data-page="${currentReplyPage - 1}">&laquo;</a></li>`
				+ pageNums.map(function (p) {
					return `<li class="page-item${p === currentReplyPage ? ' active' : ''}"><a class="page-link" href="#" data-page="${p}">${p}</a></li>`;
				}).join('')
				+ `<li class="page-item${currentReplyPage >= lastPage ? ' disabled' : ''}"><a class="page-link" href="#" data-page="${currentReplyPage + 1}">&raquo;</a></li>`;

			replyPaginationUl.innerHTML = pagHtml;

			replyPaginationUl.querySelectorAll('.page-link').forEach(function (link) {
				link.addEventListener('click', function (e) {
					e.preventDefault();
					var p = parseInt(this.getAttribute('data-page'));
					if (p >= 1) {
						currentReplyPage = p;
						loadMessages();
						var dropZone = messageDetail.querySelector('.forums-message-detail__drop-zone');
						if (dropZone) dropZone.scrollIntoView({ behavior: 'smooth' });
					}
				});
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
					{ value: 'spam', label: messageDetail.dataset.labelSpam || 'Spam' },
					{ value: 'harmful-dangerous-acts', label: messageDetail.dataset.labelHarmfulDangerousActs || 'Harmful Dangerous Acts' },
					{ value: 'harassment-bullying', label: messageDetail.dataset.labelHarassmentBullying || 'Harassment or Bullying' },
					{ value: 'nudity-sexual-content', label: messageDetail.dataset.labelNuditySexualContent || 'Nudity or Sexual Content' },
					{ value: 'other', label: messageDetail.dataset.labelOther || 'Other' }
				];

				var optionsHtml = reasonOptions.map(function (opt) {
					return `<option value="${Liferay.Util.escapeHTML(opt.value)}">${Liferay.Util.escapeHTML(opt.label)}</option>`;
				}).join('');

				modal.innerHTML = `
					<div class="modal-dialog modal-dialog-centered">
						<div class="modal-content">
							<div class="modal-header">
								<h1 class="modal-title" id="forumsReportModalHeading" tabindex="-1">${Liferay.Util.escapeHTML(messageDetail.dataset.labelReportInappropriateContent || 'Report Inappropriate Content')}</h1>
								<button class="close btn btn-unstyled forums-report-modal-close" type="button" aria-label="Close">
									<svg class="lexicon-icon lexicon-icon-times" role="presentation">
										<use href="${clayIconsUrl}#times"></use>
									</svg>
								</button>
							</div>
							<div class="modal-body">
								<p class="text-secondary">${Liferay.Util.escapeHTML(messageDetail.dataset.labelReportDescription || 'You are about to report a violation of our Terms of Use. All reports are strictly confidential.')}</p>
								<div class="form-group">
									<label for="forumsReportReason" class="font-weight-bold">${Liferay.Util.escapeHTML(messageDetail.dataset.labelReasonForReport || 'Reason for the Report')}</label>
									<select class="form-control" id="forumsReportReason">
										${optionsHtml}
									</select>
								</div>
							</div>
							<div class="modal-footer">
								<div class="modal-item-last">
									<div class="btn-group-spaced" role="group">
										<button class="btn btn-secondary forums-report-modal-close" type="button">${Liferay.Util.escapeHTML(messageDetail.dataset.labelCancel || 'Cancel')}</button>
										<button class="btn btn-primary" type="button" id="forumsReportModalSubmitBtn">${Liferay.Util.escapeHTML(messageDetail.dataset.labelReport || 'Report')}</button>
									</div>
								</div>
							</div>
						</div>
					</div>`;
				document.body.appendChild(modal);

				modal.querySelectorAll('.forums-report-modal-close').forEach(function (btn) {
					btn.addEventListener('click', function () {
						modal.style.display = 'none';
						modal.classList.remove('show');
					});
				});

				modal.querySelector('#forumsReportModalSubmitBtn').addEventListener('click', function () {
					var reason = modal.querySelector('#forumsReportReason').value;
					var submitBtn = this;
					submitBtn.disabled = true;
					submitBtn.textContent = '...';

					if (reportModalObj && reportModalObj.onSubmit) {
						reportModalObj.onSubmit(reason, function () {
							modal.style.display = 'none';
							modal.classList.remove('show');
							submitBtn.disabled = false;
							submitBtn.textContent = messageDetail.dataset.labelReport || 'Report';
						}, function () {
							submitBtn.disabled = false;
							submitBtn.textContent = messageDetail.dataset.labelReport || 'Report';
						});
					}
				});
			}

			var selectEl = modal.querySelector('#forumsReportReason');
			if (selectEl) selectEl.selectedIndex = 0;

			reportModalObj = { onSubmit: onSubmit };

			modal.style.display = 'block';
			setTimeout(function () {
				modal.classList.add('show');
			}, 10);
		}

		/* Flag message handler (shell options dropdown) */
		if (flagBtn) {
			flagBtn.addEventListener('click', function (e) {
				e.preventDefault();
				if (flagBtn.disabled) return;
				var optionsMenu = flagBtn.closest('.dropdown-menu');
				if (optionsMenu) optionsMenu.classList.remove('show');

				showReportModal(function (reason, onSuccess, onError) {
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
							suspiciousMessageId: parseInt(messageId),
							r_threadSuspiciousActivities_c_forumThreadId: parseInt(messageId)
						});
					}

					Liferay.Util.fetch(flagUrl, {
						headers: headers,
						method: flagMethod,
						body: flagBody
					})
					.then(function (r) {
						if (r.ok) {
							return r.json().then(function (body) {
								existingFlagId = body.id;
								onSuccess();
								flagBtn.textContent = messageDetail.dataset.labelFlagged || 'Flagged';
								flagBtn.classList.add('disabled');
								flagBtn.disabled = true;
								if (Liferay.Util && Liferay.Util.openToast) {
									Liferay.Util.openToast({
										message: messageDetail.dataset.labelReportSubmitted || 'Thank you! Your report has been submitted.',
										type: 'success'
									});
								}
							});
						} else {
							onError();
							console.error('Report submission failed');
						}
					})
					.catch(function (err) {
						onError();
						console.error('Report error:', err);
					});
				});
			});
		}

		if (Liferay.ThemeDisplay.isSignedIn()) {
			Liferay.Util.fetch(portalURL + '/o/c/forumbans/scopes/' + scopeGroupId + '?filter=' + encodeURIComponent('banUserId eq ' + currentUserId) + '&pageSize=1', {
				headers: headers,
				method: 'GET'
			})
			.then(function (r) { return r.json(); })
			.then(function (data) {
				if (data.items && data.items.length > 0) {
					isBanned = true;
				}
				initMessageDetail();
			})
			.catch(function (err) {
				console.error('Error checking ban status', err);
				initMessageDetail();
			});
		} else {
			initMessageDetail();
		}

	} // end runMessageDetail

	/* Resolve messageId: ?messageId param → mapped reply ERC → mapped message ERC */
	if (messageId) {
		runMessageDetail(messageId, null);
	} else {
		var replyErcEl = messageDetail.querySelector('#forumsDetailReplyERC');
		var replyErc = replyErcEl ? replyErcEl.textContent.trim() : null;
		if (replyErc === 'Mappable Reply ERC') replyErc = null;

		if (replyErc) {
			Liferay.Util.fetch(portalURL + '/o/c/forummessages/scopes/' + scopeGroupId + '/by-external-reference-code/' + encodeURIComponent(replyErc), {
				headers: headers,
				method: 'GET'
			})
			.then(function (r) {
				if (!r.ok) throw new Error('Not found');
				return r.json();
			})
			.then(function (reply) {
				var parentMessageId = reply.r_threadMessages_c_forumThreadId;
				runMessageDetail(parentMessageId ? String(parentMessageId) : null, reply.id ? String(reply.id) : null);
			})
			.catch(function () { runMessageDetail(null, null); });
		} else {
			var ercEl = messageDetail.querySelector('#forumsDetailERC');
			var erc = ercEl ? ercEl.textContent.trim() : null;
			if (erc === 'Mappable Message ERC') erc = null;

			if (!erc) {
				if (loadingEl) loadingEl.innerHTML = '<div class="forums-message-list__empty text-secondary text-center py-5">' + (messageDetail.dataset.labelErcNotMapped || 'Message ERC is not mapped.') + '</div>';
			} else {
				Liferay.Util.fetch(portalURL + '/o/c/forumthreads/scopes/' + scopeGroupId + '/by-external-reference-code/' + encodeURIComponent(erc), {
					headers: headers,
					method: 'GET'
				})
				.then(function (r) {
					if (!r.ok) throw new Error('Not found');
					return r.json();
				})
				.then(function (data) {
					runMessageDetail(data.id ? String(data.id) : null, null);
				})
				.catch(function () { runMessageDetail(null, null); });
			}
		}
	}
}

// SPDX-License-Identifier: LGPL-2.1-or-later

/* ===========================================================================
   Forums Message Detail child — STANDARD

   Renders the original post, solution cards, and reply tree from the payload
   the shell publishes on window.forumsMessageDetail. This fragment owns markup
   + local DOM wiring only; the shell owns data, REST, and vote/answer state.
   Vote/answer/delete go through payload.api; reply/edit reuse the existing
   window.forumsOpenComposeModal channel. See the shell (forums-message-detail
   index.js) for the full contract.
   =========================================================================== */

var root = fragmentElement.querySelector('#forumsMessageDetailStandard');

if (root) {
	/* Register with the shell defensively — this child may run before or after
	   the shell. We only rely on the shared _subs array + payload cache. */
	var FMD = (window.forumsMessageDetail = window.forumsMessageDetail || {});
	FMD._subs = FMD._subs || [];

	/* DOM refs (child-owned) */
	var authorInfoEl = root.querySelector('#forumsDetailAuthorInfo');
	var opSection = root.querySelector('#forumsDetailOP');
	var opBody = root.querySelector('#forumsDetailOPBody');
	var opAvatar = root.querySelector('#forumsDetailOPAvatar');
	var opAuthor = root.querySelector('#forumsDetailOPAuthor');
	var opDate = root.querySelector('#forumsDetailOPDate');
	var opTags = root.querySelector('#forumsDetailOPTags');
	var opVoteEl = root.querySelector('#forumsDetailOPVote');
	var replyBtn = root.querySelector('#forumsDetailReplyBtn');
	var solutionSection = root.querySelector('#forumsDetailSolutionSection');
	var solutionCards = root.querySelector('#forumsDetailSolutionCards');
	var repliesSection = root.querySelector('#forumsDetailRepliesSection');
	var replyCards = root.querySelector('#forumsDetailReplyCards');
	var replyCountEl = root.querySelector('#forumsDetailReplyCount');

	function L(key, fallback) { return root.dataset[key] || fallback; }

	/* Live render context, refreshed on every payload. */
	var state = null;
	var h = null;             /* api.helpers */
	var api = null;
	var clayIconsUrl = '';
	var replyMessagesMap = {};

	/* ---- Reply options dropdown (delegated; bound once so it survives re-renders).
	   Positioned fixed while open so an ancestor's overflow:hidden can't clip it. */
	function closeReplyOptionMenus(except) {
		root.querySelectorAll('.forums-message-detail__reply-options .dropdown-menu.show').forEach(function (menu) {
			if (menu === except) return;
			menu.classList.remove('show');
			menu.style.position = '';
			menu.style.top = '';
			menu.style.left = '';
			menu.style.right = '';
			menu.style.zIndex = '';
			var toggle = menu.previousElementSibling;
			if (toggle) toggle.setAttribute('aria-expanded', 'false');
		});
	}
	root.addEventListener('click', function (e) {
		var toggle = e.target.closest('[id^="forumsReplyOptions_"]');
		if (!toggle) return;
		e.preventDefault();
		var menu = toggle.nextElementSibling;
		if (!menu || !menu.classList.contains('dropdown-menu')) return;
		var willOpen = !menu.classList.contains('show');
		closeReplyOptionMenus(menu);
		if (willOpen) {
			var rect = toggle.getBoundingClientRect();
			menu.style.position = 'fixed';
			menu.style.top = Math.round(rect.bottom + 2) + 'px';
			menu.style.left = 'auto';
			menu.style.right = Math.round(window.innerWidth - rect.right) + 'px';
			menu.style.zIndex = '1050';
		}
		menu.classList.toggle('show', willOpen);
		toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
	});
	document.addEventListener('click', function (e) {
		if (!e.target.closest('.forums-message-detail__reply-options')) closeReplyOptionMenus(null);
	});
	document.addEventListener('keydown', function (e) {
		if (e.key === 'Escape') closeReplyOptionMenus(null);
	});
	window.addEventListener('scroll', function () { closeReplyOptionMenus(null); }, true);
	window.addEventListener('resize', function () { closeReplyOptionMenus(null); });

	/* OP reply ("Comment") button — bound once, visibility toggled per render. */
	if (replyBtn) {
		replyBtn.addEventListener('click', function () {
			if (state && typeof window.forumsOpenComposeModal === 'function') {
				window.forumsOpenComposeModal({ messageId: state.messageId });
			} else if (typeof window.forumsOpenComposeModal !== 'function') {
				alert(L('labelReplyFormNotFound', 'Reply form not found on this page. Please add the forums-message-composer fragment.'));
			}
		});
	}

	function renderReplyCard(msg, isSolution, depth) {
		depth = depth || 0;
		var creator = msg.creator || {};
		var name = h.displayName(creator) || L('labelUnknown', 'Unknown');
		var body = msg.body || '';
		var dateFull = h.fullDateTime(msg.dateCreated);
		var date = '<time datetime="' + msg.dateCreated + '" title="' + dateFull + '" aria-label="' + dateFull + '">' + h.timeAgo(msg.dateCreated) + '</time>';
		var score = msg.voteScore || 0;
		var solClass = isSolution ? ' forums-message-detail__reply-card--solution' : '';
		var depthStyle = depth > 0 ? ' style="margin-left:' + (depth * 2.5) + 'rem"' : '';
		var userVote = state.userVoteMap[msg.id];
		var upActive = userVote && userVote.voteValue === 1 ? ' active' : '';
		var downActive = userVote && userVote.voteValue === -1 ? ' active' : '';
		var isUpPressed = userVote && userVote.voteValue === 1 ? 'true' : 'false';
		var isDownPressed = userVote && userVote.voteValue === -1 ? 'true' : 'false';
		var upIcon = userVote && userVote.voteValue === 1 ? 'thumbs-up-full' : 'thumbs-up';
		var downIcon = userVote && userVote.voteValue === -1 ? 'thumbs-down-full' : 'thumbs-down';

		var hasEditAction = !!(msg.actions && (msg.actions['update'] || msg.actions['patch'] || msg.actions['PUT']));
		var hasDeleteAction = !!(msg.actions && msg.actions['delete']);
		var hasOptions = hasEditAction || hasDeleteAction;
		var optionsLabel = L('labelOptions', 'Options');
		var hasAcceptedAnswer = state.currentAnswerId != null;
		var canMarkAnswer = state.isQuestion
			&& (state.canUpdateMessage || (state.opCreatorId && String(state.opCreatorId) === String(state.currentUserId)))
			&& depth === 0
			&& (!hasAcceptedAnswer || isSolution);
		var isAuthor = state.opCreatorId && String(creator.id) === String(state.opCreatorId);

		return `<div class="forums-message-detail__reply-card${solClass}" data-message-id="${msg.id}"${depthStyle}>
			<div class="autofit-row forums-message-detail__reply-layout">
				<div class="autofit-col mr-2">
					${h.renderAvatar(creator, 'sm')}
				</div>
				<div class="autofit-col autofit-col-expand forums-message-detail__reply-content">
					<div class="forums-message-detail__reply-header">
						<span class="text-dark font-weight-bold">${h.escapeHTML(name)}</span>
						${isAuthor ? `<span class="label forums-message-detail__author-badge">${L('labelAuthor', 'Author')}</span>` : ''}
						<span class="text-secondary small">${date}</span>
						${isSolution ? (function () {
							var tmpl = L('labelAnswerSelectedBy', 'Answer selected by {0}');
							var parts = tmpl.split('{0}');
							return `<span class="small forums-message-detail__answer-selected-by"><svg class="lexicon-icon lexicon-icon-check-circle-full" role="presentation"><use href="${clayIconsUrl}#check-circle-full"></use></svg>${h.escapeHTML(parts[0] || '')}<span class="forums-message-detail__answer-selected-by-name">${h.escapeHTML(state.opAuthorName)}</span>${h.escapeHTML(parts[1] || '')}</span>`;
						})() : ''}
					</div>
					<div class="forums-message-detail__reply-body">${body}</div>
					<div class="forums-message-detail__reply-actions">
						${state.canReply ? `<button class="btn btn-outline-primary btn-sm" type="button" data-forums-compose data-forums-reply data-forums-message-id="${msg.r_threadMessages_c_forumThreadId}" data-forums-parent-id="${msg.id}">${L('labelReply', 'Reply')}</button>` : ''}
						${hasOptions ? `<div class="dropdown forums-message-detail__reply-options">
							<button class="btn btn-monospaced btn-sm btn-outline-borderless btn-outline-secondary dropdown-toggle" type="button" id="forumsReplyOptions_${msg.id}" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" aria-label="${optionsLabel}" title="${optionsLabel}">
								<svg class="lexicon-icon lexicon-icon-ellipsis-v" role="presentation"><use href="${clayIconsUrl}#ellipsis-v"></use></svg>
							</button>
							<div class="dropdown-menu dropdown-menu-right" aria-labelledby="forumsReplyOptions_${msg.id}">
								${hasEditAction ? `<a class="dropdown-item forums-edit-reply-btn" href="#" data-message-id="${msg.id}">${L('labelEditReply', 'Edit Reply')}</a>` : ''}
								${hasDeleteAction ? `<a class="dropdown-item text-danger forums-delete-btn" href="#" data-delete-url="${msg.actions['delete'].href}">${L('labelDeleteReply', 'Delete Reply')}</a>` : ''}
							</div>
						</div>` : ''}
						<div class="align-items-center d-inline-flex text-secondary forums-vote" data-message-id="${msg.id}">
							<button class="btn-thumbs-up btn btn-monospaced btn-outline-borderless btn-sm btn-outline-secondary forums-vote__btn forums-vote__btn--up${upActive}" type="button" aria-pressed="${isUpPressed}"${state.canVote ? ` data-vote-dir="up" data-message-id="${msg.id}"` : ' disabled'} title="${L('labelUpvote', 'Upvote')}">
								<svg class="lexicon-icon lexicon-icon-${upIcon}" role="presentation"><use href="${clayIconsUrl}#${upIcon}"></use></svg>
							</button>
							<span class="font-weight-bold p-1 forums-vote__score" data-vote-score="${msg.id}">${score}</span>
							<button class="btn-thumbs-down btn btn-monospaced btn-outline-borderless btn-sm btn-outline-secondary forums-vote__btn forums-vote__btn--down${downActive}" type="button" aria-pressed="${isDownPressed}"${state.canVote ? ` data-vote-dir="down" data-message-id="${msg.id}"` : ' disabled'} title="${L('labelDownvote', 'Downvote')}">
								<svg class="lexicon-icon lexicon-icon-${downIcon}" role="presentation"><use href="${clayIconsUrl}#${downIcon}"></use></svg>
							</button>
						</div>
						${canMarkAnswer ? `<button class="btn btn-sm ${isSolution ? 'btn-success' : 'btn-outline-secondary'} forums-answer-btn" data-answer-message-id="${msg.id}" data-is-answer="${isSolution ? 'true' : 'false'}">${isSolution ? `&#10003; ${L('labelAccepted', 'Accepted')}` : L('labelMarkAsAnswer', 'Mark as Answer')}</button>` : ''}
					</div>
				</div>
			</div>
		</div>`;
	}

	function renderTree(nodes) {
		return nodes.map(function (node) {
			return renderReplyCard(node.msg, node.isSolution, node.depth);
		}).join('');
	}

	/* Repaint a vote widget from the shell-authoritative { score, voteValue }. */
	function paintVote(messageId, result) {
		var scoreEl = root.querySelector('[data-vote-score="' + messageId + '"]');
		if (scoreEl) scoreEl.textContent = result.score;

		var voteContainer = root.querySelector('.forums-vote[data-message-id="' + messageId + '"]');
		if (!voteContainer) return;
		var upBtn = voteContainer.querySelector('.forums-vote__btn--up');
		var downBtn = voteContainer.querySelector('.forums-vote__btn--down');
		var isUp = result.voteValue === 1;
		var isDown = result.voteValue === -1;

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

	function attachVoteHandlers() {
		root.querySelectorAll('.forums-vote__btn').forEach(function (btn) {
			btn.addEventListener('click', function (e) {
				e.preventDefault();
				var msgId = this.getAttribute('data-message-id');
				var dir = this.getAttribute('data-vote-dir');
				if (msgId && dir && api) {
					var id = parseInt(msgId);
					api.vote(id, dir).then(function (res) { if (res) paintVote(id, res); });
				}
			});
		});
	}

	function attachAnswerHandlers() {
		root.querySelectorAll('.forums-answer-btn').forEach(function (btn) {
			btn.addEventListener('click', function (e) {
				e.preventDefault();
				var msgId = parseInt(this.getAttribute('data-answer-message-id'));
				var isAnswer = this.getAttribute('data-is-answer') === 'true';
				this.style.opacity = '0.5';
				this.style.pointerEvents = 'none';
				if (api) api.markAnswer(msgId, isAnswer);
			});
		});
	}

	/* Reply deletes only — the OP/topic delete lives in the shell's dropdown. */
	function attachDeleteHandlers() {
		root.querySelectorAll('.forums-delete-btn').forEach(function (btn) {
			btn.addEventListener('click', function (e) {
				e.preventDefault();
				var deleteUrl = this.getAttribute('data-delete-url');
				var card = this.closest('.forums-message-detail__reply-card');
				if (deleteUrl && api) api.deleteReply(deleteUrl, card);
			});
		});
	}

	function attachEditReplyHandlers() {
		root.querySelectorAll('.forums-edit-reply-btn').forEach(function (btn) {
			btn.addEventListener('click', function (e) {
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

	function paintOP(op) {
		if (!op) return;
		var creator = op.creator || {};

		if (opBody) {
			opBody.innerHTML = op.body || '';
			h.formatMarkupCodeBlocks(opBody);
		}
		if (opAvatar) {
			var opAvatarCls = 'sticker sticker-circle sticker-lg';
			if (creator.image) {
				opAvatar.className = opAvatarCls;
				opAvatar.innerHTML = '<span class="sticker-overlay"><img class="sticker-img" src="' + h.escapeHTML(creator.image) + '" alt="' + h.escapeHTML(h.displayName(creator)) + '"></span>';
			} else {
				opAvatar.className = opAvatarCls + ' ' + h.avatarColorClass(creator);
				opAvatar.innerHTML = '<span class="sticker-overlay">' + h.escapeHTML(h.avatarInitial(h.displayName(creator))) + '</span>';
			}
		}
		if (opAuthor) opAuthor.textContent = h.displayName(creator) || L('labelUnknown', 'Unknown');
		if (opDate) {
			opDate.textContent = h.timeAgo(op.dateCreated);
			var opDateFull = h.fullDateTime(op.dateCreated);
			opDate.title = opDateFull;
			opDate.setAttribute('aria-label', opDateFull);
		}

		if (opTags && state.messageTagsArray && state.messageTagsArray.length > 0) {
			opTags.innerHTML = state.messageTagsArray.map(function (tag) {
				return `<span class="label label-lg forums-message-detail__tag"><span class="label-item label-item-expand">${h.escapeHTML(tag)}</span></span>`;
			}).join('');
			opTags.style.display = '';
		}

		if (opSection) opSection.style.display = '';
		if (authorInfoEl) authorInfoEl.style.display = '';

		if (opVoteEl) {
			var opScore = op.voteScore || 0;
			var opUserVote = state.userVoteMap[op.id];
			var opUpActive = opUserVote && opUserVote.voteValue === 1 ? ' active' : '';
			var opDownActive = opUserVote && opUserVote.voteValue === -1 ? ' active' : '';
			var opIsUpPressed = opUserVote && opUserVote.voteValue === 1 ? 'true' : 'false';
			var opIsDownPressed = opUserVote && opUserVote.voteValue === -1 ? 'true' : 'false';
			var opUpIcon = opUserVote && opUserVote.voteValue === 1 ? 'thumbs-up-full' : 'thumbs-up';
			var opDownIcon = opUserVote && opUserVote.voteValue === -1 ? 'thumbs-down-full' : 'thumbs-down';

			opVoteEl.className = 'align-items-center d-inline-flex justify-content-center text-secondary forums-vote';
			opVoteEl.setAttribute('data-message-id', op.id);
			var upvoteTitle = L('labelUpvote', 'Upvote');
			var downvoteTitle = L('labelDownvote', 'Downvote');
			opVoteEl.innerHTML = `
				<button class="btn-thumbs-up btn btn-monospaced btn-outline-borderless btn-outline-secondary forums-vote__btn forums-vote__btn--up${opUpActive}" type="button" aria-pressed="${opIsUpPressed}"${state.canVote ? ` data-vote-dir="up" data-message-id="${op.id}"` : ' disabled'} title="${upvoteTitle}">
					<svg class="lexicon-icon lexicon-icon-${opUpIcon}" role="presentation"><use href="${clayIconsUrl}#${opUpIcon}"></use></svg>
				</button>
				<span class="font-weight-bold mx-2 forums-vote__score" data-vote-score="${op.id}">${opScore}</span>
				<button class="btn-thumbs-down btn btn-monospaced btn-outline-borderless btn-outline-secondary forums-vote__btn forums-vote__btn--down${opDownActive}" type="button" aria-pressed="${opIsDownPressed}"${state.canVote ? ` data-vote-dir="down" data-message-id="${op.id}"` : ' disabled'} title="${downvoteTitle}">
					<svg class="lexicon-icon lexicon-icon-${opDownIcon}" role="presentation"><use href="${clayIconsUrl}#${opDownIcon}"></use></svg>
				</button>`;
		}
	}

	function render(payload) {
		state = payload;
		api = payload.api;
		h = payload.api.helpers;
		clayIconsUrl = payload.clayIconsUrl;

		/* Rebuild the id -> message map (OP + solutions + replies) for edit lookups. */
		replyMessagesMap = {};
		if (payload.op) replyMessagesMap[payload.op.id] = payload.op;
		(payload.solutions || []).forEach(function (m) { replyMessagesMap[m.id] = m; });
		(payload.replyTree || []).forEach(function (n) { replyMessagesMap[n.msg.id] = n.msg; });

		/* Reset containers (idempotent under repeated payloads). */
		if (solutionCards) solutionCards.innerHTML = '';
		if (replyCards) replyCards.innerHTML = '';
		if (solutionSection) solutionSection.style.display = 'none';
		if (repliesSection) repliesSection.style.display = 'none';
		if (opSection) opSection.style.display = 'none';
		if (authorInfoEl) authorInfoEl.style.display = 'none';
		if (opTags) { opTags.innerHTML = ''; opTags.style.display = 'none'; }

		paintOP(payload.op);

		if (replyBtn) replyBtn.style.display = payload.canReply ? '' : 'none';

		/* Solutions */
		if (payload.solutions && payload.solutions.length > 0) {
			if (solutionSection) solutionSection.style.display = '';
			var solHtml = payload.solutions.map(function (sol) { return renderReplyCard(sol, true, 0); }).join('');
			if (solutionCards) {
				solutionCards.innerHTML = solHtml;
				h.formatMarkupCodeBlocks(solutionCards);
			}
		}

		/* Regular replies */
		if ((payload.replyTree && payload.replyTree.length > 0) || payload.regularReplyCount > 0) {
			if (repliesSection) repliesSection.style.display = '';
			if (replyCountEl) {
				var tmpl = payload.regularReplyCount === 1
					? L('labelXReply', '{0} reply')
					: L('labelXReplies', '{0} replies');
				replyCountEl.textContent = tmpl.replace('{0}', payload.regularReplyCount);
			}
			if (replyCards) {
				replyCards.innerHTML = renderTree(payload.replyTree || []);
				h.formatMarkupCodeBlocks(replyCards);
			}
		}

		attachVoteHandlers();
		attachAnswerHandlers();
		attachDeleteHandlers();
		attachEditReplyHandlers();

		if (typeof FMD.notifyRendered === 'function') FMD.notifyRendered();
	}

	FMD._subs.push(render);
	if (FMD.payload) render(FMD.payload);
}

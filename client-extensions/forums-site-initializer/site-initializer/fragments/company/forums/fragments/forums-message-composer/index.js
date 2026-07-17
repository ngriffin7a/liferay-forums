// SPDX-License-Identifier: LGPL-2.1-or-later
var messageComposer = fragmentElement.querySelector('#forumsMessageComposer');

if (messageComposer) {
	var portalURL = Liferay.ThemeDisplay.getPortalURL();
	var scopeGroupId = Liferay.ThemeDisplay.getScopeGroupId();
	var headers = {
		'Accept': 'application/json',
		'Content-Type': 'application/json'
	};

	/* DOM refs */
	var modal = messageComposer.querySelector('#forumsMessageComposerModal');
	var backdrop = messageComposer.querySelector('#forumsMessageComposerBackdrop');
	var closeBtn = messageComposer.querySelector('#forumsMessageComposerCloseBtn');
	var form = messageComposer.querySelector('#forumsMessageComposerForm');
	var titleEl = messageComposer.querySelector('#forumsMessageComposerTitle');
	var categorySelect = messageComposer.querySelector('#forumsMessageComposerCategory');
	var categoryGroup = messageComposer.querySelector('#forumsMessageComposerCategoryGroup');
	var subjectInput = messageComposer.querySelector('#forumsMessageComposerSubject');
	var subjectGroup = messageComposer.querySelector('#forumsMessageComposerSubjectGroup');
	var questionCheck = messageComposer.querySelector('#forumsMessageComposerQuestion');
	var questionGroup = messageComposer.querySelector('#forumsMessageComposerQuestionGroup');
	var prioritySelect = messageComposer.querySelector('#forumsMessageComposerPriority');
	var priorityGroup = messageComposer.querySelector('#forumsMessageComposerPriorityGroup');
	var subscribeCheck = messageComposer.querySelector('#forumsMessageComposerSubscribe');
	var subscribeGroup = messageComposer.querySelector('#forumsMessageComposerSubscribeGroup');
	var tagsGroup = messageComposer.querySelector('#forumsMessageComposerTagsGroup');
	var leftCol = messageComposer.querySelector('#forumsMessageComposerLeftCol');
	var tagsInput = messageComposer.querySelector('#forumsMessageComposerTagsInput');
	var tagsList = messageComposer.querySelector('#forumsMessageComposerTagsList');
	var bodyLabel = messageComposer.querySelector('#forumsMessageComposerBodyLabel');
	var bodyError = messageComposer.querySelector('#forumsMessageComposerBodyError');
	var submitBtn = messageComposer.querySelector('#forumsMessageComposerSubmit');
	var cancelBtn = messageComposer.querySelector('#forumsMessageComposerCancel');
	var successAlert = messageComposer.querySelector('#forumsMessageComposerSuccess');
	var errorAlert = messageComposer.querySelector('#forumsMessageComposerError');
	var attachBtn = messageComposer.querySelector('#forumsMessageComposerAttachBtn');
	var fileInput = messageComposer.querySelector('#forumsMessageComposerFileInput');
	var pendingFilesEl = messageComposer.querySelector('#forumsMessageComposerPendingFiles');
	var existingFilesEl = messageComposer.querySelector('#forumsMessageComposerExistingFiles');

	/* Files staged for the next post. Uploaded as ForumMessageAttachment rows once
	   the message is created/edited (see uploadAttachments). Matches the object
	   field's maximumFileSize (10 MB) so we can reject oversized files up front. */
	var stagedFiles = [];
	var MAX_FILE_SIZE = 10 * 1024 * 1024;

	/* Edit mode only: the message's already-uploaded attachments, and the ids the
	   user has marked for removal. Removals are staged (like new files) and applied
	   on Save, so Cancel reverts. Only attachments the current user uploaded show a
	   remove control (deletion is also enforced server-side by object ownership). */
	var existingAttachments = [];
	var removedAttachmentIds = [];

	/* CKEditor instance tracking */
	var editorName = fragmentElementId + '-forumsMessageComposerBody';
	var bodyEditorInstance = null;

	var editorPromise = new Promise(function(resolve) {
		function matchesName(editor) {
			if (!editor) {
				return false;
			}
			var name = editor.name ||
				(editor.config && (typeof editor.config.get === 'function') &&
					editor.config.get('name'));
			return name === editorName;
		}

		/* Resolve as soon as the editor is ready, regardless of which editor
		   the server actually rendered. The LPD-11235 client flag and the
		   rendered editor can disagree (e.g. the flag is toggled at runtime
		   without restarting the server, so the server still renders the
		   legacy editor while the client behaves as if CKEditor 5 is active).
		   To stay correct either way we listen for BOTH the CKEditor 5
		   "ckeditor:ready" event and the legacy CKEditor "instanceReady"
		   event, and also resolve an instance that is already ready. */
		Liferay.on('ckeditor:ready', function(event) {
			if (matchesName(event && event.editor)) {
				resolve(event.editor);
			}
		});

		if (window.CKEDITOR) {
			if (CKEDITOR.instances && CKEDITOR.instances[editorName]) {
				resolve(CKEDITOR.instances[editorName]);
			}

			CKEDITOR.on('instanceReady', function(event) {
				if (matchesName(event && event.editor)) {
					resolve(event.editor);
				}
			});
		}
	});

	editorPromise.then(function(editor) {
		bodyEditorInstance = editor;
		try {
			if (typeof editor.resize === 'function') {
				/* Reduce default height to save vertical space in the modal */
				editor.resize('100%', 120);
			}
		} catch (e) {
			console.warn('Could not resize CKEditor', e);
		}
	});

	/* Read the editor content defensively: if the editor promise has not
	   resolved (e.g. the rendered editor and the LPD-11235 flag disagree),
	   fall back to the legacy CKEditor instance or the underlying textarea so
	   the body is never reported as empty when the user has typed something. */
	function getEditorData() {
		if (bodyEditorInstance && (typeof bodyEditorInstance.getData === 'function')) {
			return bodyEditorInstance.getData() || '';
		}
		if (window.CKEDITOR && CKEDITOR.instances &&
			CKEDITOR.instances[editorName] &&
			(typeof CKEDITOR.instances[editorName].getData === 'function')) {

			return CKEDITOR.instances[editorName].getData() || '';
		}
		var textarea = document.getElementById(editorName);
		if (textarea && (typeof textarea.value === 'string')) {
			return textarea.value;
		}
		return '';
	}

	/* ---- Attachment staging ---- */

	function renderPendingFiles() {
		if (!pendingFilesEl) return;
		pendingFilesEl.innerHTML = '';
		stagedFiles.forEach(function(file, index) {
			var chip = document.createElement('span');
			chip.className = 'label label-secondary label-dismissible forums-message-composer__pending-file';
			var removeLabel = (messageComposer.dataset.labelRemove || 'Remove');
			chip.innerHTML = '<span class="label-item label-item-expand">' +
				Liferay.Util.escapeHTML(file.name) + '</span>' +
				'<span class="label-item label-item-after"><button class="close" type="button" data-file-index="' +
				index + '" aria-label="' + Liferay.Util.escapeHTML(removeLabel) + '">×</button></span>';
			pendingFilesEl.appendChild(chip);
		});
	}

	/* Render the message's existing attachments (edit mode). Each shows a remove ×
	   only when the current user uploaded it; clicking stages it for deletion on
	   Save. Files marked for removal are hidden. */
	function renderExistingAttachments() {
		if (!existingFilesEl) return;
		existingFilesEl.innerHTML = '';
		var removeLabelTmpl = messageComposer.dataset.labelRemoveAttachment || 'Remove {0}';
		existingAttachments.forEach(function(att) {
			if (removedAttachmentIds.indexOf(att.id) !== -1) return;
			var file = att.file || {};
			var name = file.name || (file.link && file.link.label) || att.id;
			var canRemove = att.creator &&
				String(att.creator.id) === String(currentUserId);
			var chip = document.createElement('span');
			chip.className = 'label label-secondary forums-message-composer__existing-file';
			var inner = '<span class="label-item label-item-expand">' + Liferay.Util.escapeHTML(String(name)) + '</span>';
			if (canRemove) {
				var removeLabel = Liferay.Util.escapeHTML(removeLabelTmpl.replace('{0}', name));
				inner += '<span class="label-item label-item-after"><button class="close" type="button" data-attachment-id="' +
					att.id + '" aria-label="' + removeLabel + '" title="' + removeLabel + '">×</button></span>';
			}
			chip.innerHTML = inner;
			existingFilesEl.appendChild(chip);
		});
	}

	/* Fetch the attachments already on the message being edited so they can be shown
	   (and optionally removed) in the dialog. */
	function loadExistingAttachments(messageId) {
		if (!existingFilesEl || !messageId) return;
		/* The relationship FK is filtered as a quoted value (an unquoted numeric
		   yields a 400 "Incompatible types."), matching the message-detail fragment. */
		var filter = encodeURIComponent("r_messageAttachments_c_forumMessageId eq '" + messageId + "'");
		Liferay.Util.fetch(portalURL + '/o/c/forummessageattachments/scopes/' + scopeGroupId + '?nestedFields=file&pageSize=100&filter=' + filter, {
			headers: headers,
			method: 'GET'
		})
		.then(function(r) { return r.json(); })
		.then(function(data) {
			existingAttachments = (data && data.items) || [];
			renderExistingAttachments();
		})
		.catch(function(err) { console.warn('ForumsMessageComposer: failed to load existing attachments', err); });
	}

	if (existingFilesEl) {
		existingFilesEl.addEventListener('click', function(e) {
			var btn = e.target.closest('.close');
			if (btn) {
				var id = parseInt(btn.getAttribute('data-attachment-id'), 10);
				if (removedAttachmentIds.indexOf(id) === -1) removedAttachmentIds.push(id);
				renderExistingAttachments();
			}
		});
	}

	/* Delete the attachments the user marked for removal (edit mode, on Save). */
	function deleteRemovedAttachments() {
		if (!removedAttachmentIds.length) return Promise.resolve();
		return Promise.all(removedAttachmentIds.map(function(id) {
			return Liferay.Util.fetch(portalURL + '/o/c/forummessageattachments/' + id, {
				headers: headers,
				method: 'DELETE'
			}).catch(function(err) {
				console.warn('ForumsMessageComposer: attachment delete failed', err);
			});
		}));
	}

	if (attachBtn && fileInput) {
		attachBtn.addEventListener('click', function() {
			fileInput.click();
		});
		fileInput.addEventListener('change', function() {
			Array.prototype.forEach.call(fileInput.files, function(file) {
				if (file.size > MAX_FILE_SIZE) {
					if (Liferay.Util && Liferay.Util.openToast) {
						Liferay.Util.openToast({
							message: (messageComposer.dataset.labelFileTooLarge || 'The file is too large.') + ' (' + file.name + ')',
							type: 'danger'
						});
					}
					return;
				}
				stagedFiles.push(file);
			});
			/* Reset so selecting the same file again re-fires change. */
			fileInput.value = '';
			renderPendingFiles();
		});
	}

	if (pendingFilesEl) {
		pendingFilesEl.addEventListener('click', function(e) {
			var btn = e.target.closest('.close');
			if (btn) {
				var index = parseInt(btn.getAttribute('data-file-index'), 10);
				stagedFiles.splice(index, 1);
				renderPendingFiles();
			}
		});
	}

	/* Read a File as base64 (no data: prefix) for the object Attachment field payload. */
	function fileToBase64(file) {
		return new Promise(function(resolve, reject) {
			var reader = new FileReader();
			reader.onload = function() {
				var result = String(reader.result || '');
				var comma = result.indexOf(',');
				resolve(comma >= 0 ? result.slice(comma + 1) : result);
			};
			reader.onerror = function() { reject(reader.error || new Error('read failed')); };
			reader.readAsDataURL(file);
		});
	}

	/* Upload every staged file as a ForumMessageAttachment row hanging off the given
	   message. The Attachment field takes the file inline as {name, fileBase64}; the
	   row inherits the scope-level Site Member VIEW so any member can download it.
	   Best-effort per file so one failure doesn't abort the rest. */
	function uploadAttachments(messageId) {
		if (!messageId || !stagedFiles.length) return Promise.resolve();
		return Promise.all(stagedFiles.map(function(file) {
			return fileToBase64(file).then(function(base64) {
				var body = {
					file: { name: file.name, fileBase64: base64 },
					r_messageAttachments_c_forumMessageId: parseInt(messageId)
				};
				return Liferay.Util.fetch(portalURL + '/o/c/forummessageattachments/scopes/' + scopeGroupId + '?nestedFields=file', {
					headers: headers,
					method: 'POST',
					body: JSON.stringify(body)
				});
			}).catch(function(err) {
				console.warn('ForumsMessageComposer: attachment upload failed', err);
			});
		}));
	}

	/* Detect mode from URL */
	var urlParams = new URLSearchParams(window.location.search);
	var messageId = urlParams.get('messageId');
	var categoryIdParam = urlParams.get('categoryId');
	var isReplyMode = !!messageId;
	var parentMessageId = null;
	var categoriesLoaded = false;
	var isEditMode = false;
	var editMessageId = null;
	var editIsOp = false;
	var tagsArray = [];
	
	var isBanned = false;
	var currentUserId = Liferay.ThemeDisplay.getUserId();

	/* Thread priority (Message Boards parity). Whether the priority select is
	   offered is gated the same way the moderation page detects moderators: the
	   HATEOAS create action on the ForumBan collection, which regular users are
	   never granted. Like ban enforcement, this is UI-only — see the README. */
	var canSetPriority = false;
	/* True while the form is in a mode where priority applies (new topic or
	   edit topic, never replies). Combined with canSetPriority, which may
	   resolve after the modal is already open. */
	var priorityApplicable = false;

	function syncPriorityGroup() {
		if (priorityGroup) {
			priorityGroup.style.display = (priorityApplicable && canSetPriority) ? '' : 'none';
		}
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
				if (submitBtn) submitBtn.disabled = true;
				if (errorAlert) {
					errorAlert.textContent = messageComposer.dataset.labelBannedWarning || 'Your account has been banned from participating in the forums.';
					errorAlert.style.display = '';
				}
			}
			canSetPriority = !isBanned && !!(data.actions && (data.actions['create'] || data.actions['post'] || data.actions['POST']));
			syncPriorityGroup();
		})
		.catch(function(err) { console.error('Error checking ban status', err); });
	}

	function trackForumStatsUser() {
		if (!Liferay.ThemeDisplay.isSignedIn()) return;
		var userId = Liferay.ThemeDisplay.getUserId();
		Liferay.Util.fetch(portalURL + '/o/c/forumstatsusers/scopes/' + scopeGroupId + '?filter=' + encodeURIComponent("statsUserId eq " + userId), {
			headers: headers,
			method: 'GET'
		})
		.then(function(r) { return r.json(); })
		.then(function(data) {
			if (data.totalCount === 0) {
				Liferay.Util.fetch(portalURL + '/o/c/forumstatsusers/scopes/' + scopeGroupId, {
					headers: headers,
					method: 'POST',
					body: JSON.stringify({
						statsUserId: parseInt(userId)
					})
				}).catch(function(e) { console.error('Error creating ForumStatsUser', e); });
			}
		})
		.catch(function(err) { console.error('Error tracking ForumStatsUser', err); });
	}

	/* ---- Tags Logic ---- */

	function renderTags() {
		if (!tagsList) return;
		tagsList.innerHTML = '';
		tagsArray.forEach(function(tag, index) {
			var span = document.createElement('span');
			span.className = 'label label-secondary label-dismissible';
			span.innerHTML = '<span class="label-item label-item-expand">' + tag + '</span>' +
				'<span class="label-item label-item-after"><button class="close" type="button" data-tag-index="' + index + '" aria-label="Close">×</button></span>';
			tagsList.appendChild(span);
		});
	}

	if (tagsInput) {
		tagsInput.addEventListener('keydown', function(e) {
			if (e.key === ',' || e.key === 'Enter') {
				e.preventDefault();
				var val = tagsInput.value.trim().replace(/,/g, '');
				if (val && tagsArray.indexOf(val) === -1) {
					tagsArray.push(val);
					tagsInput.value = '';
					renderTags();
				} else if (val) {
					tagsInput.value = '';
				}
			} else if (e.key === 'Backspace' && tagsInput.value === '' && tagsArray.length > 0) {
				tagsArray.pop();
				renderTags();
			}
		});
	}

	if (tagsList) {
		tagsList.addEventListener('click', function(e) {
			var btn = e.target.closest('.close');
			if (btn) {
				var index = parseInt(btn.getAttribute('data-tag-index'), 10);
				tagsArray.splice(index, 1);
				renderTags();
			}
		});
	}

	/* ---- Modal show / hide (vanilla JS) ---- */

	var _modalTrigger = null;

	function showModal() {
		_modalTrigger = document.activeElement;
		if (modal) {
			modal.style.display = 'block';
			modal.classList.add('show');
			modal.setAttribute('aria-hidden', 'false');
		}
		if (backdrop) {
			backdrop.style.display = 'block';
			backdrop.classList.add('show');
		}
		document.body.classList.add('modal-open');
		/* Move focus into the dialog itself (not the close button) so screen
		   readers announce the modal and Esc/Tab work from a neutral start. */
		if (modal) modal.focus();
	}

	function hideModal() {
		if (modal) {
			modal.classList.remove('show');
			modal.style.display = 'none';
			modal.setAttribute('aria-hidden', 'true');
		}
		if (backdrop) {
			backdrop.classList.remove('show');
			backdrop.style.display = 'none';
		}
		document.body.classList.remove('modal-open');
		resetForm();
		/* Return focus to the element that opened the modal */
		if (_modalTrigger && typeof _modalTrigger.focus === 'function') {
			_modalTrigger.focus();
			_modalTrigger = null;
		}
	}

	function resetForm() {
		if (form) form.reset();
		if (successAlert) successAlert.style.display = 'none';
		if (errorAlert) errorAlert.style.display = 'none';
		if (bodyError) bodyError.style.display = 'none';
		if (submitBtn) {
			submitBtn.disabled = isBanned;
			submitBtn.textContent = messageComposer.dataset.labelPost || 'Post';
		}
		if (bodyEditorInstance) {
			bodyEditorInstance.setData('');
		}
		messageComposer.querySelectorAll('.is-invalid').forEach(function(el) {
			el.classList.remove('is-invalid');
		});
		isEditMode = false;
		editIsOp = false;
		editMessageId = null;
		if (prioritySelect) prioritySelect.value = '0';
		tagsArray = [];
		if (tagsInput) tagsInput.value = '';
		renderTags();
		stagedFiles = [];
		if (fileInput) fileInput.value = '';
		renderPendingFiles();
		existingAttachments = [];
		removedAttachmentIds = [];
		if (existingFilesEl) existingFilesEl.innerHTML = '';
	}

	/* "page" mode renders the form on its own screen (no modal); "modal" mode
	   keeps the Clay dialog used for replies and edits. */
	var formMode = messageComposer.dataset.formMode || 'modal';

	/* Close via X button, Cancel button, or backdrop click. In page mode the
	   Cancel button just navigates back instead of closing a dialog. */
	if (closeBtn) closeBtn.addEventListener('click', hideModal);
	if (cancelBtn) {
		cancelBtn.addEventListener('click', function() {
			if (formMode === 'page') {
				window.history.back();
			} else {
				hideModal();
			}
		});
	}
	if (backdrop) backdrop.addEventListener('click', hideModal);

	/* Close on Escape key */
	document.addEventListener('keydown', function(e) {
		if (e.key === 'Escape' && modal && modal.classList.contains('show')) {
			hideModal();
		}
	});

	/* ---- Configure form for new-message vs reply mode ---- */

	function configureModal(replyMode) {
		priorityApplicable = (isEditMode && editIsOp) || (!isEditMode && !replyMode);
		syncPriorityGroup();
		if (isEditMode && editIsOp) {
			if (titleEl) titleEl.textContent = messageComposer.dataset.labelEditTopic || 'Edit Topic';
			if (leftCol) leftCol.style.display = '';
			if (categoryGroup) categoryGroup.style.display = '';
			if (subjectGroup) subjectGroup.style.display = '';
			if (questionGroup) questionGroup.style.display = '';
			if (subscribeGroup) subscribeGroup.style.display = 'none';
			if (tagsGroup) tagsGroup.style.display = '';
			if (bodyLabel) bodyLabel.textContent = messageComposer.dataset.labelDetails || 'Details';
			if (submitBtn) submitBtn.textContent = messageComposer.dataset.labelSaveChanges || 'Save';
			loadCategories();
		} else if (isEditMode && !editIsOp) {
			if (titleEl) titleEl.textContent = messageComposer.dataset.labelEditReply || 'Edit Reply';
			/* Keep the left column visible so the Attachments section shows; the
			   topic-only field groups below are hidden individually. */
			if (leftCol) leftCol.style.display = '';
			if (categoryGroup) categoryGroup.style.display = 'none';
			if (subjectGroup) subjectGroup.style.display = 'none';
			if (questionGroup) questionGroup.style.display = 'none';
			if (subscribeGroup) subscribeGroup.style.display = 'none';
			if (tagsGroup) tagsGroup.style.display = 'none';
			if (bodyLabel) bodyLabel.textContent = messageComposer.dataset.labelYourReply || 'Your Reply';
			if (submitBtn) submitBtn.textContent = messageComposer.dataset.labelSaveChanges || 'Save';
		} else if (replyMode) {
			if (titleEl) titleEl.textContent = messageComposer.dataset.labelPostAReply || 'Post a Reply';
			/* Keep the left column visible so the Attachments section shows; the
			   topic-only field groups below are hidden individually. */
			if (leftCol) leftCol.style.display = '';
			if (categoryGroup) categoryGroup.style.display = 'none';
			if (subjectGroup) subjectGroup.style.display = 'none';
			if (questionGroup) questionGroup.style.display = 'none';
			if (subscribeGroup) subscribeGroup.style.display = 'none';
			if (tagsGroup) tagsGroup.style.display = 'none';
			if (bodyLabel) bodyLabel.textContent = messageComposer.dataset.labelYourReply || 'Your Reply';
			if (submitBtn) submitBtn.textContent = messageComposer.dataset.labelPost || 'Post';
		} else {
			if (titleEl) titleEl.textContent = messageComposer.dataset.labelNewForumThread || 'New Forum Thread';
			if (leftCol) leftCol.style.display = '';
			if (categoryGroup) categoryGroup.style.display = '';
			if (subjectGroup) subjectGroup.style.display = '';
			if (questionGroup) questionGroup.style.display = '';
			if (subscribeGroup) subscribeGroup.style.display = '';
			if (tagsGroup) tagsGroup.style.display = '';
			if (bodyLabel) bodyLabel.textContent = messageComposer.dataset.labelDetails || 'Details';
			if (submitBtn) submitBtn.textContent = messageComposer.dataset.labelPost || 'Post';
			loadCategories();
		}
	}

	/* Load categories into dropdown (only once) */
	function loadCategories() {
		if (categoriesLoaded) return;
		categoriesLoaded = true;

		Liferay.Util.fetch(portalURL + '/o/c/forumcategories/scopes/' + scopeGroupId + '?pageSize=50&sort=categoryName:asc', {
			headers: headers,
			method: 'GET'
		})
		.then(function(r) { return r.json(); })
		.then(function(data) {
			var items = data.items || [];
			items.forEach(function(cat) {
				var opt = document.createElement('option');
				opt.value = cat.id;
				opt.textContent = cat.categoryName || messageComposer.dataset.labelUnnamed || 'Unnamed';
				if (categoryIdParam && String(cat.id) === categoryIdParam) {
					opt.selected = true;
				}
				categorySelect.appendChild(opt);
			});
		})
		.catch(function(err) {
			console.error('ForumsMessageComposer: failed to load categories', err);
		});
	}

	/* ---- Public API for other fragments ---- */

	window.forumsOpenComposeModal = function(options) {
		options = options || {};
		var replyMode = !!options.messageId && !options.editMode;
		isEditMode = !!options.editMode;
		editIsOp = !!options.isOp;
		editMessageId = options.messageId || null;

		if (options.threadId) messageId = options.threadId;
		else if (options.messageId) messageId = options.messageId;
		if (options.categoryId) categoryIdParam = String(options.categoryId);
		parentMessageId = options.parentMessageId || null;
		isReplyMode = replyMode;
		configureModal(replyMode);

		if (isEditMode) {
			loadExistingAttachments(editMessageId);
			if (subjectInput && options.subject) subjectInput.value = options.subject;
			if (questionCheck && typeof options.isQuestion !== 'undefined') questionCheck.checked = options.isQuestion;
			if (prioritySelect) {
				/* Priority arrives as a decimal (e.g. 2.0); the select only knows
				   the discrete MB levels 0-3, anything else falls back to None. */
				var priorityValue = String(Math.round(parseFloat(options.priority)) || 0);
				prioritySelect.value = priorityValue;
				if (prioritySelect.value !== priorityValue) prioritySelect.value = '0';
			}
			if (options.tags && Array.isArray(options.tags)) {
				tagsArray = [].concat(options.tags);
				renderTags();
			}
			if (options.body && bodyEditorInstance) {
				bodyEditorInstance.setData(options.body);
			} else if (options.body) {
				/* Wait for editor to be ready if it's not yet */
				editorPromise.then(function(editor) {
					editor.setData(options.body);
				});
			}
			if (options.categoryId && categorySelect) {
				/* Ensure categories are loaded before setting value */
				if (!categoriesLoaded) {
					loadCategories();
					setTimeout(function() { categorySelect.value = String(options.categoryId); }, 500);
				} else {
					categorySelect.value = String(options.categoryId);
				}
			}
		} else if (!replyMode && options.categoryId && categorySelect) {
			categorySelect.value = String(options.categoryId);
		}

		showModal();
	};

	/* Listen for any element with data-forums-compose attribute */
	document.addEventListener('click', function(e) {
		var trigger = e.target.closest('[data-forums-compose]');
		if (trigger) {
			e.preventDefault();
			var composeMessageId = trigger.getAttribute('data-forums-message-id') || messageId;
			var composeCategoryId = trigger.getAttribute('data-forums-category-id') || categoryIdParam;
			var composeMessageId = trigger.getAttribute('data-forums-message-id') || null;
			/* For a reply to another reply, the root ForumMessage id is the
			   foreign key (data-forums-message-id) and the reply being answered
			   is the threading parent (data-forums-parent-id). */
			var composeParentId = trigger.getAttribute('data-forums-parent-id') || composeMessageId;
			var rawTags = trigger.getAttribute('data-forums-tags');
			var parsedTags = [];
			if (rawTags) {
				try { parsedTags = JSON.parse(rawTags); } catch (e) {}
			}
			window.forumsOpenComposeModal({
				messageId: trigger.hasAttribute('data-forums-reply') ? composeMessageId : null,
				categoryId: composeCategoryId,
				parentMessageId: composeParentId,
				tags: parsedTags
			});
		}
	});

	/* Initial configuration */
	configureModal(isReplyMode);

	/* SPA-friendly navigation helper */
	function spaNavigate(url) {
		if (Liferay.SPA && Liferay.SPA.app) {
			Liferay.SPA.app.navigate(url);
		} else {
			window.location.href = url;
		}
	}

	/* Check for pending success toast from a previous redirect */
	var pendingToast = sessionStorage.getItem('forumsSuccessToast');
	if (pendingToast) {
		sessionStorage.removeItem('forumsSuccessToast');
		Liferay.on('allPortletsReady', function() {
			setTimeout(function() {
				if (Liferay.Util && Liferay.Util.openToast) {
					Liferay.Util.openToast({
						message: pendingToast,
						title: messageComposer.dataset.labelSuccess || 'Success',
						type: 'success'
					});
				}
			}, 1000);
		});
	}

	/* Auto-open modal if ?compose=true is in the URL */
	if (urlParams.get('compose') === 'true') {
		showModal();
	}

	/* ---- Form submission ---- */

	if (form) {
		form.addEventListener('submit', function(e) {
			e.preventDefault();
			if (isBanned) return;
			
			if (successAlert) successAlert.style.display = 'none';
			if (errorAlert) errorAlert.style.display = 'none';

			var body = getEditorData();

			/* Strip HTML to check if it's completely empty */
			var tempDiv = document.createElement('div');
			tempDiv.innerHTML = body;
			var textContent = tempDiv.textContent || tempDiv.innerText || '';
			
			if (!textContent.trim()) {
				if (bodyError) bodyError.style.display = 'block';
				return;
			} else {
				if (bodyError) bodyError.style.display = 'none';
			}

			if (isEditMode) {
				var selectedCategory = categorySelect ? categorySelect.value : '';
				var subject = subjectInput ? subjectInput.value.trim() : '';
				var isQuestion = questionCheck ? questionCheck.checked : false;
				var valid = true;

				if (editIsOp) {
					if (!selectedCategory) { categorySelect.classList.add('is-invalid'); valid = false; } else { categorySelect.classList.remove('is-invalid'); }
					if (!subject) { subjectInput.classList.add('is-invalid'); valid = false; } else { subjectInput.classList.remove('is-invalid'); }
				}
				if (!valid) return;

				submitBtn.disabled = true;
				submitBtn.textContent = messageComposer.dataset.labelPosting || 'Posting...';

				var promises = [];
				if (editIsOp) {
					var threadPatchPayload = {
						messageTitle: subject,
						messageTitle_i18n: { en_US: subject },
						r_categoryThreads_c_forumCategoryId: parseInt(selectedCategory),
						question: isQuestion,
						keywords: tagsArray
					};
					/* Only privileged users may change the priority; omitting the
					   field keeps the thread's current value (MB resets a priority
					   sent without UPDATE_THREAD_PRIORITY the same way). */
					if (canSetPriority && prioritySelect) {
						threadPatchPayload.priority = parseFloat(prioritySelect.value) || 0;
					}
					promises.push(
						Liferay.Util.fetch(portalURL + '/o/c/forumthreads/' + messageId, {
							headers: headers,
							method: 'PATCH',
							body: JSON.stringify(threadPatchPayload)
						}).then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); })
					);
					promises.push(
						Liferay.Util.fetch(portalURL + '/o/c/forummessages/' + editMessageId, {
							headers: headers,
							method: 'PATCH',
							body: JSON.stringify({
								subject: subject,
								subject_i18n: { en_US: subject },
								body: body,
								r_categoryThreads_c_forumCategoryId: parseInt(selectedCategory)
							})
						}).then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); })
					);
				} else {
					promises.push(
						Liferay.Util.fetch(portalURL + '/o/c/forummessages/' + editMessageId, {
							headers: headers,
							method: 'PATCH',
							body: JSON.stringify({
								body: body
							})
						}).then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); })
					);
				}

				Promise.all(promises)
				.then(function() { return deleteRemovedAttachments(); })
				.then(function() { return uploadAttachments(editMessageId); })
				.then(function() {
					hideModal();
					sessionStorage.setItem('forumsSuccessToast', messageComposer.dataset.labelSuccess || 'Success!');
					spaNavigate(window.location.pathname + window.location.search);
				})
				.catch(function(err) {
					console.error('Edit error:', err);
					if (errorAlert) errorAlert.style.display = '';
					submitBtn.disabled = false;
					submitBtn.textContent = messageComposer.dataset.labelSaveChanges || 'Save';
				});

			} else if (isReplyMode) {
				submitBtn.disabled = true;
				submitBtn.textContent = messageComposer.dataset.labelPosting || 'Posting...';

				var replyPayload = {
					r_threadMessages_c_forumThreadId: parseInt(messageId),
					parentMessageId: parentMessageId ? parseInt(parentMessageId) : 0,
					body: body,
					format: 'html',
					subject: 'Re: reply',
					subject_i18n: { en_US: 'Re: reply' }
				};

				Liferay.Util.fetch(portalURL + '/o/c/forummessages/scopes/' + scopeGroupId, {
					headers: headers,
					method: 'POST',
					body: JSON.stringify(replyPayload)
				})
				.then(function(r) {
					if (!r.ok) throw new Error('HTTP ' + r.status);
					trackForumStatsUser();
					return r.json();
				})
				.then(function(reply) { return uploadAttachments(reply && reply.id); })
				.then(function() {
					hideModal();
					sessionStorage.setItem('forumsSuccessToast', messageComposer.dataset.labelReplyPosted || 'Reply posted successfully!');
					spaNavigate(window.location.pathname + window.location.search);
				})
				.catch(function(err) {
					console.error('Reply error:', err);
					if (errorAlert) errorAlert.style.display = '';
					submitBtn.disabled = false;
					submitBtn.textContent = messageComposer.dataset.labelPost || 'Post';
				});

			} else {
				var selectedCategory = categorySelect ? categorySelect.value : '';
				var subject = subjectInput ? subjectInput.value.trim() : '';
				var isQuestion = questionCheck ? questionCheck.checked : false;
				var valid = true;

				if (!selectedCategory) {
					categorySelect.classList.add('is-invalid');
					valid = false;
				} else {
					categorySelect.classList.remove('is-invalid');
				}

				if (!subject) {
					subjectInput.classList.add('is-invalid');
					valid = false;
				} else {
					subjectInput.classList.remove('is-invalid');
				}

				if (!valid) return;

				submitBtn.disabled = true;
				submitBtn.textContent = messageComposer.dataset.labelPosting || 'Posting...';

				var messagePayload = {
					messageTitle: subject,
					messageTitle_i18n: { en_US: subject },
					r_categoryThreads_c_forumCategoryId: parseInt(selectedCategory),
					question: isQuestion,
					keywords: tagsArray,
					priority: (canSetPriority && prioritySelect) ? (parseFloat(prioritySelect.value) || 0) : 0
				};

				Liferay.Util.fetch(portalURL + '/o/c/forumthreads/scopes/' + scopeGroupId, {
					headers: headers,
					method: 'POST',
					body: JSON.stringify(messagePayload)
				})
				.then(function(r) {
					if (!r.ok) throw new Error('HTTP ' + r.status);
					trackForumStatsUser();
					return r.json();
				})
				.then(function(msg) {
					var msgPayload = {
						r_threadMessages_c_forumThreadId: msg.id,
						r_categoryThreads_c_forumCategoryId: parseInt(selectedCategory),
						subject: subject,
						subject_i18n: { en_US: subject },
						body: body,
						format: 'html'
					};

					var promises = [];
					promises.push(Liferay.Util.fetch(portalURL + '/o/c/forummessages/scopes/' + scopeGroupId, {
						headers: headers,
						method: 'POST',
						body: JSON.stringify(msgPayload)
					}).then(function(r) {
						if (!r.ok) throw new Error('HTTP ' + r.status);
						return r.json();
					}));

					if (subscribeCheck && subscribeCheck.checked && msg.externalReferenceCode) {
						promises.push(Liferay.Util.fetch(portalURL + '/o/c/forumthreads/scopes/' + scopeGroupId + '/by-external-reference-code/' + encodeURIComponent(msg.externalReferenceCode) + '/subscribe', {
							headers: headers,
							method: 'POST'
						}).then(function(r) {
							if (!r.ok) throw new Error('HTTP ' + r.status);
						}));
					}

					return Promise.all(promises).then(function(results) {
						var rootMsg = results && results[0];
						return uploadAttachments(rootMsg && rootMsg.id);
					}).then(function() {
						if (!msg.friendlyUrlPath) {
							if (Liferay.Util && Liferay.Util.openToast) {
								Liferay.Util.openToast({
									message: messageComposer.dataset.labelDisplayPageNotConfigured || 'Message created, but the display page is not configured.',
									type: 'danger'
								});
							}
							hideModal();
							return;
						}
						hideModal();
						sessionStorage.setItem('forumsSuccessToast', messageComposer.dataset.labelQuestionPosted || 'Your question has been posted!');
						var siteSlug = (msg.scopeKey || '').toLowerCase().replace(/ /g, '-');
						spaNavigate(Liferay.ThemeDisplay.getPathFriendlyURLPublic() + '/' + siteSlug + '/c_forumthread/' + msg.friendlyUrlPath);
					});
				})
				.catch(function(err) {
					console.error('New message error:', err);
					if (errorAlert) errorAlert.style.display = '';
					submitBtn.disabled = false;
					submitBtn.textContent = messageComposer.dataset.labelPost || 'Post';
				});
			}
		});
	}

	/* ---------------------------------------------------------------------
	   @mention picker

	   Typing "@" in the body editor opens a caret-anchored dropdown of users
	   (searched via headless-admin-user). Selecting one inserts a mention as
	   an anchor: <a class="forums-mention" href="#mention-{screenName}">@Name</a>.

	   The href fragment is the reliable channel across editor versions:
	   CKEditor 5's schema may strip class/data-* attributes, but the anchor
	   href survives, so the forums-microservice parses mentioned screen names
	   from the "#mention-{screenName}" hrefs in the posted body and resolves
	   them with a single site-scoped query (see MentionService).
	   --------------------------------------------------------------------- */
	(function setupMentions() {
		var MENTION_MAX = 6;
		var mentionAttached = false;

		var dropdown = document.createElement('div');
		dropdown.className = 'forums-mention-dropdown';
		dropdown.style.display = 'none';
		dropdown.setAttribute('role', 'listbox');
		document.body.appendChild(dropdown);

		var activeIndex = -1;
		var currentItems = [];
		var currentQuery = null;    /* the text typed after "@" (may be "") */
		var fetchTimer = null;
		var lastReqId = 0;

		function mentionDisplayName(u) {
			var given = u.givenName || '';
			var family = u.familyName || '';
			var full = (given + ' ' + family).trim();
			return full || u.name || u.alternateName || '';
		}

		/* The contenteditable element the editor renders into, and helpers to
		   read the DOM selection inside it (works for both editor versions;
		   CKEditor 4 may host the editable inside an iframe). */
		function getEditableEl(editor) {
			if (editor.editing && editor.editing.view &&
				typeof editor.editing.view.getDomRoot === 'function') {
				return editor.editing.view.getDomRoot();   /* CKEditor 5 */
			}
			if (typeof editor.editable === 'function' && editor.editable()) {
				return editor.editable().$;                 /* CKEditor 4 */
			}
			return null;
		}

		function frameOffset(editableEl) {
			var win = editableEl.ownerDocument.defaultView;
			var frameEl = win && win.frameElement;
			if (frameEl) {
				var r = frameEl.getBoundingClientRect();
				return { x: r.left, y: r.top };
			}
			return { x: 0, y: 0 };
		}

		/* Inspect the caret; if it sits right after an "@token", return the
		   token text, else null. Only fires for a collapsed caret in a text
		   node so we never hijack a range selection. */
		function detectQuery(editableEl) {
			var doc = editableEl.ownerDocument;
			var sel = doc.getSelection();
			if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;
			var node = sel.anchorNode;
			if (!node || node.nodeType !== 3) return null;
			var before = node.textContent.slice(0, sel.anchorOffset);
			var m = before.match(/(?:^|[\s (\[])@([\w.\-]{0,30})$/);
			return m ? m[1] : null;
		}

		function hideDropdown() {
			dropdown.style.display = 'none';
			activeIndex = -1;
			currentItems = [];
			currentQuery = null;
		}

		function positionDropdown(editableEl) {
			var doc = editableEl.ownerDocument;
			var sel = doc.getSelection();
			if (!sel || sel.rangeCount === 0) return;
			var rect = sel.getRangeAt(0).getBoundingClientRect();
			var off = frameOffset(editableEl);
			var top = rect.bottom + off.y;
			var left = rect.left + off.x;
			if (!rect.height && !rect.width) {
				/* Some browsers return an empty rect for a collapsed caret;
				   fall back to the editable's top-left. */
				var er = editableEl.getBoundingClientRect();
				top = er.top + off.y + 24;
				left = er.left + off.x + 8;
			}
			var maxLeft = window.innerWidth - dropdown.offsetWidth - 8;
			dropdown.style.top = Math.round(top + 4) + 'px';
			dropdown.style.left = Math.round(Math.max(8, Math.min(left, maxLeft))) + 'px';
		}

		function renderDropdown(editableEl) {
			if (currentQuery === null) { hideDropdown(); return; }

			if (!currentItems.length) {
				dropdown.innerHTML = '<div class="forums-mention-dropdown__empty">' +
					Liferay.Util.escapeHTML(messageComposer.dataset.labelMentionNoUsers || 'No users found') + '</div>';
				dropdown.style.display = 'block';
				positionDropdown(editableEl);
				return;
			}

			var html = '';
			currentItems.forEach(function(u, i) {
				var name = mentionDisplayName(u);
				var screen = u.alternateName ? ('@' + u.alternateName) : '';
				var initial = (name || '?').charAt(0).toUpperCase();
				var avatar = u.image
					? '<span class="sticker sticker-circle sticker-sm"><span class="sticker-overlay"><img class="sticker-img" src="' + Liferay.Util.escapeHTML(u.image) + '" alt=""></span></span>'
					: '<span class="sticker sticker-circle sticker-sm sticker-outline-' + (i % 10) + '"><span class="sticker-overlay">' + Liferay.Util.escapeHTML(initial) + '</span></span>';
				html += '<button type="button" role="option" class="forums-mention-dropdown__item' +
					(i === activeIndex ? ' is-active' : '') + '" data-mention-index="' + i + '"' +
					(i === activeIndex ? ' aria-selected="true"' : '') + '>' +
					avatar +
					'<span class="forums-mention-dropdown__text">' +
						'<span class="forums-mention-dropdown__name">' + Liferay.Util.escapeHTML(name) + '</span>' +
						(screen ? '<span class="forums-mention-dropdown__screen">' + Liferay.Util.escapeHTML(screen) + '</span>' : '') +
					'</span>' +
					'</button>';
			});
			dropdown.innerHTML = html;
			dropdown.style.display = 'block';
			positionDropdown(editableEl);
		}

		/* Build an OData prefix filter over the name fields. `startswith` maps to
		   a prefix wildcard ("q*"), which the search index resolves efficiently
		   (unlike `contains`'s leading wildcard "*q*", which forces a term-
		   dictionary scan). Prefix matching also fits type-ahead: users type
		   names/handles from the start, and OR-ing the individual fields covers
		   first name, last name and screen name prefixes. The mapped index
		   fields are the lowercased *_sortable variants, so the value is
		   lowercased to match; single quotes are doubled per OData escaping.
		   Note: OData function names are lowercase/case-sensitive — it must be
		   `startswith`, not `startsWith` (the latter yields a 400). */
		function buildMentionFilter(query) {
			var q = query.toLowerCase().replace(/'/g, "''");
			/* Match on display-name fields and the screen name (alternateName).
			   Email is intentionally excluded so a mention search can't be used
			   to probe users by email address. */
			return ['name', 'givenName', 'familyName', 'alternateName']
				.map(function(field) { return "startswith(" + field + ",'" + q + "')"; })
				.join(' or ');
		}

		function searchUsers(query, editableEl) {
			var reqId = ++lastReqId;
			/* Scope the search to members of the current site (not the whole
			   company) and request only the fields the picker renders, for
			   smaller/faster responses. Email is intentionally NOT fetched
			   here — the notification microservice resolves it server-side
			   from the mentioned user id. */
			var url = portalURL + '/o/headless-admin-user/v1.0/sites/' + scopeGroupId + '/user-accounts' +
				'?page=1&pageSize=' + MENTION_MAX +
				'&fields=' + encodeURIComponent('id,givenName,familyName,name,alternateName,image') +
				(query ? '&filter=' + encodeURIComponent(buildMentionFilter(query)) : '');
			Liferay.Util.fetch(url, { headers: headers, method: 'GET' })
				.then(function(r) { return r.json(); })
				.then(function(data) {
					if (reqId !== lastReqId || currentQuery === null) return;
					var items = (data && data.items) || [];
					/* Never offer to mention yourself. */
					currentItems = items.filter(function(u) {
						return String(u.id) !== String(currentUserId);
					}).slice(0, MENTION_MAX);
					activeIndex = currentItems.length ? 0 : -1;
					renderDropdown(editableEl);
				})
				.catch(function() {
					if (reqId !== lastReqId) return;
					currentItems = [];
					activeIndex = -1;
					renderDropdown(editableEl);
				});
		}

		function insertMention(editor, user) {
			var name = mentionDisplayName(user) || (user.alternateName || 'user');
			/* Encode the screen name (alternateName), not the numeric id: the
			   notification microservice resolves mentions with a single
			   site-scoped query filtered on the indexed alternateName field
			   (see MentionService). Screen names are fragment-safe. */
			var href = '#mention-' + (user.alternateName || '');
			var query = currentQuery || '';
			var removeLen = query.length + 1; /* the "@" plus the typed query */

			if (editor.model && editor.editing) {
				/* CKEditor 5: delete "@query" then insert linked text + space. */
				try {
					editor.model.change(function(writer) {
						var pos = editor.model.document.selection.getFirstPosition();
						var startPos = pos.getShiftedBy(-removeLen);
						writer.remove(writer.createRange(startPos, pos));
						editor.model.insertContent(
							writer.createText('@' + name, { linkHref: href }), startPos);
						var afterPos = startPos.getShiftedBy(('@' + name).length);
						editor.model.insertContent(writer.createText(' '), afterPos);
						writer.setSelection(afterPos.getShiftedBy(1));
					});
				} catch (e) { console.warn('mention insert (v5) failed', e); }
			} else if (typeof editor.getSelection === 'function') {
				/* CKEditor 4: extend the range back over "@query", replace. */
				try {
					var sel = editor.getSelection();
					var range = sel.getRanges()[0];
					if (range && range.startOffset >= removeLen) {
						range.setStart(range.startContainer, range.startOffset - removeLen);
						range.select();
					}
					editor.insertHtml('<a class="forums-mention" href="' + href + '">@' +
						Liferay.Util.escapeHTML(name) + '</a>&nbsp;');
				} catch (e) { console.warn('mention insert (v4) failed', e); }
			}
			hideDropdown();
		}

		function choose(editor, editableEl, index) {
			if (index < 0 || index >= currentItems.length) return;
			insertMention(editor, currentItems[index]);
			editableEl.focus();
		}

		function onActivity(editor, editableEl) {
			var q = detectQuery(editableEl);
			if (q === null) { hideDropdown(); return; }
			currentQuery = q;
			if (fetchTimer) clearTimeout(fetchTimer);
			fetchTimer = setTimeout(function() { searchUsers(q, editableEl); }, 150);
		}

		function attach(editor) {
			if (mentionAttached) return;
			var editableEl = getEditableEl(editor);
			if (!editableEl) return;
			mentionAttached = true;

			['keyup', 'input', 'mouseup'].forEach(function(evt) {
				editableEl.addEventListener(evt, function() {
					/* Arrow/enter/esc are handled in keydown; skip here. */
					onActivity(editor, editableEl);
				});
			});

			/* Intercept navigation keys in the capture phase so the editor
			   doesn't also act on them while the dropdown is open. Bound on the
			   editable's document (not the element) so a document-level capture
			   listener fires before the editor's own keydown handler — CKEditor
			   4 hosts the editable in an iframe, hence ownerDocument. */
			editableEl.ownerDocument.addEventListener('keydown', function(e) {
				if (dropdown.style.display === 'none' || currentQuery === null) return;
				if (e.key === 'ArrowDown') {
					e.preventDefault(); e.stopPropagation();
					if (currentItems.length) { activeIndex = (activeIndex + 1) % currentItems.length; renderDropdown(editableEl); }
				} else if (e.key === 'ArrowUp') {
					e.preventDefault(); e.stopPropagation();
					if (currentItems.length) { activeIndex = (activeIndex - 1 + currentItems.length) % currentItems.length; renderDropdown(editableEl); }
				} else if (e.key === 'Enter' || e.key === 'Tab') {
					if (activeIndex >= 0 && currentItems.length) {
						e.preventDefault(); e.stopPropagation();
						choose(editor, editableEl, activeIndex);
					}
				} else if (e.key === 'Escape') {
					e.preventDefault(); e.stopPropagation();
					hideDropdown();
				}
			}, true);

			editableEl.addEventListener('blur', function() {
				/* Delay so a click on a dropdown item registers first. */
				setTimeout(hideDropdown, 150);
			});
		}

		/* Mouse selection from the dropdown. mousedown (not click) so it fires
		   before the editable's blur hides the list. */
		dropdown.addEventListener('mousedown', function(e) {
			var btn = e.target.closest('[data-mention-index]');
			if (!btn) return;
			e.preventDefault();
			var idx = parseInt(btn.getAttribute('data-mention-index'), 10);
			if (bodyEditorInstance) choose(bodyEditorInstance, getEditableEl(bodyEditorInstance), idx);
		});

		window.addEventListener('scroll', function() {
			if (dropdown.style.display !== 'none' && bodyEditorInstance) {
				positionDropdown(getEditableEl(bodyEditorInstance));
			}
		}, true);

		editorPromise.then(attach);
	})();
}

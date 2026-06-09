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

	/* CKEditor instance tracking */
	var editorName = fragmentElementId + '-forumsMessageComposerBody';
	var bodyEditorInstance = null;

	var editorPromise = new Promise(function(resolve) {
		if (Liferay.FeatureFlags && Liferay.FeatureFlags['LPD-11235']) {
			Liferay.on('ckeditor:ready', function(event) {
				var editor = event.editor;
				if (editorName === editor.config.get('name')) {
					resolve(editor);
				}
			});
		} else {
			if (window.CKEDITOR) {
				CKEDITOR.on('instanceReady', function(event) {
					var editor = event.editor;
					if (editor.name === editorName) {
						resolve(editor);
					}
				});
			} else {
				Liferay.on('ckeditor:ready', function(event) {
					var editor = event.editor;
					if (editorName === editor.name || editorName === (editor.config && editor.config.get('name'))) {
						resolve(editor);
					}
				});
			}
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
		tagsArray = [];
		if (tagsInput) tagsInput.value = '';
		renderTags();
	}

	/* Close via X button, Cancel button, or backdrop click */
	if (closeBtn) closeBtn.addEventListener('click', hideModal);
	if (cancelBtn) cancelBtn.addEventListener('click', hideModal);
	if (backdrop) backdrop.addEventListener('click', hideModal);

	/* Close on Escape key */
	document.addEventListener('keydown', function(e) {
		if (e.key === 'Escape' && modal && modal.classList.contains('show')) {
			hideModal();
		}
	});

	/* ---- Configure form for new-message vs reply mode ---- */

	function configureModal(replyMode) {
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
			if (leftCol) leftCol.style.display = 'none';
			if (categoryGroup) categoryGroup.style.display = 'none';
			if (subjectGroup) subjectGroup.style.display = 'none';
			if (questionGroup) questionGroup.style.display = 'none';
			if (subscribeGroup) subscribeGroup.style.display = 'none';
			if (tagsGroup) tagsGroup.style.display = 'none';
			if (bodyLabel) bodyLabel.textContent = messageComposer.dataset.labelYourReply || 'Your Reply';
			if (submitBtn) submitBtn.textContent = messageComposer.dataset.labelSaveChanges || 'Save';
		} else if (replyMode) {
			if (titleEl) titleEl.textContent = messageComposer.dataset.labelPostAReply || 'Post a Reply';
			if (leftCol) leftCol.style.display = 'none';
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
			if (subjectInput && options.subject) subjectInput.value = options.subject;
			if (questionCheck && typeof options.isQuestion !== 'undefined') questionCheck.checked = options.isQuestion;
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

			var body = '';
			if (bodyEditorInstance) {
				body = bodyEditorInstance.getData() || '';
			}
			
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
					promises.push(
						Liferay.Util.fetch(portalURL + '/o/c/forumthreads/' + messageId, {
							headers: headers,
							method: 'PATCH',
							body: JSON.stringify({
								messageTitle: subject,
								messageTitle_i18n: { en_US: subject },
								r_categoryThreads_c_forumCategoryId: parseInt(selectedCategory),
								question: isQuestion,
								keywords: tagsArray
							})
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
								r_categoryMessages_c_forumCategoryId: parseInt(selectedCategory)
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
					keywords: tagsArray
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
						r_categoryMessages_c_forumCategoryId: parseInt(selectedCategory),
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

					return Promise.all(promises).then(function() {
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
						var messageObjectRoute = configuration.messageObjectRoute || 'c_forumthread';
						spaNavigate(Liferay.ThemeDisplay.getPathFriendlyURLPublic() + '/' + siteSlug + '/' + messageObjectRoute + '/' + msg.friendlyUrlPath);
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
}

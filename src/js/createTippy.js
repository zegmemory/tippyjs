import Popper from 'popper.js'
import { isIE } from './browser'
import { isUsingTouch } from './bindGlobalEventListeners'
import Defaults, { POPPER_INSTANCE_DEPENDENCIES } from './defaults'
import Selectors from './selectors'
import {
  createPopperElement,
  updatePopperElement,
  afterPopperPositionUpdates,
  getChildren,
  getPopperPlacement,
  applyTransitionDuration,
  toggleTransitionEndListener,
  setVisibilityState,
  isCursorOutsideInteractiveBorder,
  getOffsetDistanceInPx,
} from './popper'
import { validateOptions, evaluateProps } from './props'
import { closest, closestCallback, arrayFrom } from './ponyfills'
import {
  hasOwnProperty,
  debounce,
  getValue,
  getModifier,
  includes,
  evaluateValue,
  setFlipModifierEnabled,
  canReceiveFocus,
} from './utils'
import { PASSIVE, PADDING } from './constants'

let idCounter = 1

/**
 * Creates and returns a Tippy object. We're using a closure pattern instead of
 * a class so that the exposed object API is clean without private members
 * prefixed with `_`.
 * @param {Element} reference
 * @param {Object} collectionProps
 * @return {Object} instance
 */
export default function createTippy(reference, collectionProps) {
  const props = evaluateProps(reference, collectionProps)

  // If the reference shouldn't have multiple tippys, return null early
  // @ts-ignore
  if (!props.multiple && reference._tippy) {
    return null
  }

  /* ======================= 🔒 Private members 🔒 ======================= */
  // The last trigger event object that caused the tippy to show
  let lastTriggerEvent = {}

  // The last mousemove event object created by the document mousemove event
  let lastMouseMoveEvent = null

  // Timeout created by the show delay
  let showTimeoutId = 0

  // Timeout created by the hide delay
  let hideTimeoutId = 0

  // Flag to determine if the tippy is scheduled to show due to the show timeout
  let isScheduledToShow = false

  // The current `transitionend` callback reference
  let transitionEndListener = () => {}

  // Array of event listeners currently attached to the reference element
  let listeners = []

  // Private onMouseMove handler reference, debounced or not
  let debouncedOnMouseMove =
    props.interactiveDebounce > 0
      ? debounce(onMouseMove, props.interactiveDebounce)
      : onMouseMove

  // Node the tippy is currently appended to
  let parentNode = null

  /* ======================= 🔑 Public members 🔑 ======================= */
  // id used for the `aria-describedby` / `aria-labelledby` attribute
  const id = idCounter++

  // Popper element reference
  const popper = createPopperElement(id, props)

  // Prevent a tippy with a delay from hiding if the cursor left then returned
  // before it started hiding
  popper.addEventListener('mouseenter', event => {
    if (
      instance.props.interactive &&
      instance.state.isVisible &&
      lastTriggerEvent.type === 'mouseenter'
    ) {
      scheduleShow(event)
    }
  })
  popper.addEventListener('mouseleave', () => {
    if (instance.props.interactive && lastTriggerEvent.type === 'mouseenter') {
      document.addEventListener('mousemove', debouncedOnMouseMove)
    }
  })

  // Popper element children: { arrow, backdrop, content, tooltip }
  const popperChildren = getChildren(popper)

  const state = {
    // Is the instance currently enabled?
    isEnabled: true,
    // Is the tippy currently showing and not transitioning out?
    isVisible: false,
    // Has the instance been destroyed?
    isDestroyed: false,
    // Is the tippy currently mounted to the DOM?
    isMounted: false,
    // Has the tippy finished transitioning in?
    isShown: false,
  }

  // Popper.js instance for the tippy is lazily created
  const popperInstance = null

  const instance = {
    // properties
    id,
    reference,
    popper,
    popperChildren,
    popperInstance,
    props,
    state,
    // methods
    clearDelayTimeouts,
    set,
    setContent,
    show,
    hide,
    enable,
    disable,
    destroy,
  }

  addTriggersToReference()

  if (!props.lazy) {
    createPopperInstance()
    instance.popperInstance.disableEventListeners()
  }

  if (props.showOnInit) {
    scheduleShow()
  }

  // Ensure the reference element can receive focus (and is not a delegate)
  if (props.a11y && !props.target && !canReceiveFocus(reference)) {
    reference.setAttribute('tabindex', '0')
  }

  // Install shortcuts
  // @ts-ignore
  reference._tippy = instance
  // @ts-ignore
  popper._tippy = instance

  return instance

  /* ======================= 🔒 Private methods 🔒 ======================= */
  /**
   * Positions the virtual reference near the cursor
   * @param {MouseEvent} event
   */
  function positionVirtualReferenceNearCursor(event) {
    const { clientX, clientY } = (lastMouseMoveEvent = event)

    if (!instance.popperInstance) {
      return
    }

    // Ensure virtual reference is padded to prevent tooltip from
    // overflowing. Maybe Popper.js issue?
    const placement = getPopperPlacement(instance.popper)
    const padding = instance.props.arrow
      ? PADDING + (instance.props.arrowType === 'round' ? 18 : 16)
      : PADDING
    const isVerticalPlacement = includes(['top', 'bottom'], placement)
    const isHorizontalPlacement = includes(['left', 'right'], placement)

    // Top / left boundary
    let x = isVerticalPlacement ? Math.max(padding, clientX) : clientX
    let y = isHorizontalPlacement ? Math.max(padding, clientY) : clientY

    // Bottom / right boundary
    if (isVerticalPlacement && x > padding) {
      x = Math.min(clientX, window.innerWidth - padding)
    }
    if (isHorizontalPlacement && y > padding) {
      y = Math.min(clientY, window.innerHeight - padding)
    }

    const rect = instance.reference.getBoundingClientRect()
    const { followCursor } = instance.props
    const isHorizontal = followCursor === 'horizontal'
    const isVertical = followCursor === 'vertical'

    instance.popperInstance.reference = {
      getBoundingClientRect: () => ({
        width: 0,
        height: 0,
        top: isHorizontal ? rect.top : y,
        bottom: isHorizontal ? rect.bottom : y,
        left: isVertical ? rect.left : x,
        right: isVertical ? rect.right : x,
      }),
      clientWidth: 0,
      clientHeight: 0,
    }

    instance.popperInstance.scheduleUpdate()

    if (followCursor === 'initial' && instance.state.isVisible) {
      removeFollowCursorListener()
    }
  }

  /**
   * Creates the tippy instance for a delegate when it's been triggered
   * @param {Event} event
   */
  function createDelegateChildTippy(event) {
    // @ts-ignore
    const targetEl = closest(event.target, instance.props.target)
    // @ts-ignore
    if (targetEl && !targetEl._tippy) {
      createTippy(targetEl, {
        ...instance.props,
        content: evaluateValue(collectionProps.content, [targetEl]),
        appendTo: collectionProps.appendTo,
        target: '',
        showOnInit: true,
      })
      scheduleShow(event)
    }
  }

  /**
   * Setup before show() is invoked (delays, etc.)
   * @param {Event} [event]
   */
  function scheduleShow(event) {
    clearDelayTimeouts()

    if (instance.state.isVisible) {
      return
    }

    // Is a delegate, create an instance for the child target
    if (instance.props.target) {
      return createDelegateChildTippy(event)
    }

    isScheduledToShow = true

    if (instance.props.wait) {
      return instance.props.wait(instance, event)
    }

    // If the tooltip has a delay, we need to be listening to the mousemove as
    // soon as the trigger event is fired, so that it's in the correct position
    // upon mount.
    // Edge case: if the tooltip is still mounted, but then scheduleShow() is
    // called, it causes a jump.
    if (hasFollowCursorBehavior() && !instance.state.isMounted) {
      document.addEventListener('mousemove', positionVirtualReferenceNearCursor)
    }

    const delay = getValue(instance.props.delay, 0, Defaults.delay)

    if (delay) {
      // @ts-ignore
      showTimeoutId = setTimeout(() => {
        show()
      }, delay)
    } else {
      show()
    }
  }

  /**
   * Setup before hide() is invoked (delays, etc.)
   */
  function scheduleHide() {
    clearDelayTimeouts()

    if (!instance.state.isVisible) {
      return removeFollowCursorListener()
    }

    isScheduledToShow = false

    const delay = getValue(instance.props.delay, 1, Defaults.delay)

    if (delay) {
      // @ts-ignore
      hideTimeoutId = setTimeout(() => {
        if (instance.state.isVisible) {
          hide()
        }
      }, delay)
    } else {
      hide()
    }
  }

  /**
   * Removes the follow cursor listener
   */
  function removeFollowCursorListener() {
    document.removeEventListener(
      'mousemove',
      positionVirtualReferenceNearCursor,
    )
  }

  /**
   * Cleans up old listeners
   */
  function cleanupOldMouseListeners() {
    document.body.removeEventListener('mouseleave', scheduleHide)
    document.removeEventListener('mousemove', debouncedOnMouseMove)
  }

  /**
   * Event listener invoked upon trigger
   * @param {Event} event
   */
  function onTrigger(event) {
    if (!instance.state.isEnabled || isEventListenerStopped(event)) {
      return
    }

    if (!instance.state.isVisible) {
      lastTriggerEvent = event

      if (event instanceof MouseEvent) {
        lastMouseMoveEvent = event
      }
    }

    // Toggle show/hide when clicking click-triggered tooltips
    if (
      event.type === 'click' &&
      instance.props.hideOnClick !== false &&
      instance.state.isVisible
    ) {
      scheduleHide()
    } else {
      scheduleShow(event)
    }
  }

  /**
   * Event listener used for interactive tooltips to detect when they should
   * hide
   * @param {MouseEvent} event
   */
  function onMouseMove(event) {
    const referenceTheCursorIsOver = closestCallback(
      // @ts-ignore
      event.target,
      el => el._tippy,
    )

    const isCursorOverPopper =
      // @ts-ignore
      closest(event.target, Selectors.POPPER) === instance.popper
    const isCursorOverReference =
      referenceTheCursorIsOver === instance.reference

    if (isCursorOverPopper || isCursorOverReference) {
      return
    }

    if (
      isCursorOutsideInteractiveBorder(
        getPopperPlacement(instance.popper),
        instance.popper.getBoundingClientRect(),
        event,
        instance.props,
      )
    ) {
      cleanupOldMouseListeners()
      scheduleHide()
    }
  }

  /**
   * Event listener invoked upon mouseleave
   * @param {MouseEvent} event
   */
  function onMouseLeave(event) {
    if (isEventListenerStopped(event)) {
      return
    }

    if (instance.props.interactive) {
      document.body.addEventListener('mouseleave', scheduleHide)
      document.addEventListener('mousemove', debouncedOnMouseMove)
      return
    }

    scheduleHide()
  }

  /**
   * Event listener invoked upon blur
   * @param {FocusEvent} event
   */
  function onBlur(event) {
    if (event.target !== instance.reference) {
      return
    }

    if (
      instance.props.interactive &&
      event.relatedTarget &&
      // @ts-ignore
      instance.popper.contains(event.relatedTarget)
    ) {
      return
    }

    scheduleHide()
  }

  /**
   * Event listener invoked when a child target is triggered
   * @param {Event} event
   */
  function onDelegateShow(event) {
    // @ts-ignore
    if (closest(event.target, instance.props.target)) {
      scheduleShow(event)
    }
  }

  /**
   * Event listener invoked when a child target should hide
   * @param {Event} event
   */
  function onDelegateHide(event) {
    // @ts-ignore
    if (closest(event.target, instance.props.target)) {
      scheduleHide()
    }
  }

  /**
   * Determines if an event listener should stop further execution due to the
   * `touchHold` option
   * @param {Event} event
   */
  function isEventListenerStopped(event) {
    const supportsTouch = 'ontouchstart' in window
    const isTouchEvent = includes(event.type, 'touch')
    const { touchHold } = instance.props
    return (
      (supportsTouch && isUsingTouch && touchHold && !isTouchEvent) ||
      (isUsingTouch && !touchHold && isTouchEvent)
    )
  }

  /**
   * Creates the popper instance for the instance
   */
  function createPopperInstance() {
    const { popperOptions } = instance.props
    const { tooltip, arrow } = instance.popperChildren

    instance.popperInstance = new Popper(instance.reference, instance.popper, {
      placement: instance.props.placement,
      ...popperOptions,
      modifiers: {
        ...(popperOptions ? popperOptions.modifiers : {}),
        preventOverflow: {
          boundariesElement: instance.props.boundary,
          padding: PADDING,
          ...getModifier(popperOptions, 'preventOverflow'),
        },
        arrow: {
          element: arrow,
          enabled: !!arrow,
          ...getModifier(popperOptions, 'arrow'),
        },
        flip: {
          enabled: instance.props.flip,
          // The tooltip is offset by 10px from the popper in CSS,
          // we need to account for its distance
          padding: instance.props.distance + PADDING,
          behavior: instance.props.flipBehavior,
          ...getModifier(popperOptions, 'flip'),
        },
        offset: {
          offset: instance.props.offset,
          ...getModifier(popperOptions, 'offset'),
        },
      },
      onUpdate(data) {
        if (instance.props.flip && !instance.props.flipOnUpdate) {
          if (data.flipped) {
            instance.popperInstance.options.placement = data.placement
          }
          setFlipModifierEnabled(instance.popperInstance.modifiers, false)
        }

        const basePlacement = getPopperPlacement(instance.popper)
        const styles = tooltip.style

        // Account for the `distance` offset
        styles.top = ''
        styles.bottom = ''
        styles.left = ''
        styles.right = ''
        styles[basePlacement] = getOffsetDistanceInPx(instance.props.distance)

        // Avoid _defineProperty helper function created by Babel
        const padding = {
          top: PADDING,
          bottom: PADDING,
          left: PADDING,
          right: PADDING,
        }
        padding[basePlacement] = PADDING + instance.props.distance
        instance.popperInstance.modifiers.filter(
          m => m.name === 'preventOverflow',
        )[0].padding = padding

        if (popperOptions && popperOptions.onUpdate) {
          popperOptions.onUpdate(data)
        }
      },
    })
  }

  /**
   * Mounts the tooltip to the DOM, callback to show tooltip is run **after**
   * popper's position has updated
   * @param {Function} callback
   */
  function mount(callback) {
    const shouldEnableListeners =
      !hasFollowCursorBehavior() &&
      !(instance.props.followCursor === 'initial' && isUsingTouch)

    if (!instance.popperInstance) {
      createPopperInstance()
      if (!shouldEnableListeners) {
        instance.popperInstance.disableEventListeners()
      }
    } else {
      if (!hasFollowCursorBehavior()) {
        instance.popperInstance.scheduleUpdate()
        if (shouldEnableListeners) {
          instance.popperInstance.enableEventListeners()
        }
      }
      setFlipModifierEnabled(
        instance.popperInstance.modifiers,
        instance.props.flip,
      )
    }

    // If the instance previously had followCursor behavior, it will be
    // positioned incorrectly if triggered by `focus` afterwards.
    // Update the reference back to the real DOM element
    instance.popperInstance.reference = instance.reference
    const { arrow } = instance.popperChildren

    if (hasFollowCursorBehavior()) {
      if (arrow) {
        arrow.style.margin = '0'
      }
      const delay = getValue(instance.props.delay, 0, Defaults.delay)
      if (lastTriggerEvent.type) {
        positionVirtualReferenceNearCursor(
          delay && lastMouseMoveEvent ? lastMouseMoveEvent : lastTriggerEvent,
        )
      }
    } else if (arrow) {
      arrow.style.margin = ''
    }

    // Allow followCursor: 'initial' on touch devices
    if (
      isUsingTouch &&
      lastMouseMoveEvent &&
      instance.props.followCursor === 'initial'
    ) {
      positionVirtualReferenceNearCursor(lastMouseMoveEvent)
      if (arrow) {
        arrow.style.margin = '0'
      }
    }

    afterPopperPositionUpdates(instance.popperInstance, callback)

    const { appendTo } = instance.props

    parentNode =
      appendTo === 'parent'
        ? instance.reference.parentNode
        : evaluateValue(appendTo, [instance.reference])

    if (!parentNode.contains(instance.popper)) {
      parentNode.appendChild(instance.popper)
      instance.props.onMount(instance)
      instance.state.isMounted = true
    }
  }

  /**
   * Determines if the instance is in `followCursor` mode
   * @return {Boolean}
   */
  function hasFollowCursorBehavior() {
    return (
      instance.props.followCursor &&
      !isUsingTouch &&
      lastTriggerEvent.type !== 'focus'
    )
  }

  /**
   * Updates the tooltip's position on each animation frame
   */
  function makeSticky() {
    applyTransitionDuration(
      [instance.popper],
      isIE ? 0 : instance.props.updateDuration,
    )

    function updatePosition() {
      if (instance.popperInstance) {
        instance.popperInstance.scheduleUpdate()
      }

      if (instance.state.isMounted) {
        requestAnimationFrame(updatePosition)
      } else {
        applyTransitionDuration([instance.popper], 0)
      }
    }

    updatePosition()
  }

  /**
   * Invokes a callback once the tooltip has fully transitioned out
   * @param {Number} duration
   * @param {Function} callback
   */
  function onTransitionedOut(duration, callback) {
    onTransitionEnd(duration, () => {
      if (
        !instance.state.isVisible &&
        parentNode &&
        parentNode.contains(instance.popper)
      ) {
        callback()
      }
    })
  }

  /**
   * Invokes a callback once the tooltip has fully transitioned in
   * @param {Number} duration
   * @param {Function} callback
   */
  function onTransitionedIn(duration, callback) {
    onTransitionEnd(duration, callback)
  }

  /**
   * Invokes a callback once the tooltip's CSS transition ends
   * @param {Number} duration
   * @param {Function} callback
   */
  function onTransitionEnd(duration, callback) {
    /**
     * Listener added as the `transitionend` handler
     */
    function listener(event) {
      if (event.target === tooltip) {
        toggleTransitionEndListener(tooltip, 'remove', listener)
        callback()
      }
    }

    // Make callback synchronous if duration is 0
    // `transitionend` won't fire otherwise
    if (duration === 0) {
      return callback()
    }

    const { tooltip } = instance.popperChildren

    toggleTransitionEndListener(tooltip, 'remove', transitionEndListener)
    toggleTransitionEndListener(tooltip, 'add', listener)

    transitionEndListener = listener
  }

  /**
   * Adds an event listener to the reference and stores it in `listeners`
   * @param {String} eventType
   * @param {EventListenerOrEventListenerObject} handler
   * @param {Object|Boolean} options
   */
  function on(eventType, handler, options = false) {
    instance.reference.addEventListener(eventType, handler, options)
    listeners.push({ eventType, handler, options })
  }

  /**
   * Adds event listeners to the reference based on the `trigger` prop
   */
  function addTriggersToReference() {
    if (instance.props.touchHold && !instance.props.target) {
      on('touchstart', onTrigger, PASSIVE)
      on('touchend', onMouseLeave, PASSIVE)
    }

    instance.props.trigger
      .trim()
      .split(' ')
      .forEach(eventType => {
        if (eventType === 'manual') {
          return
        }

        // Non-delegates
        if (!instance.props.target) {
          on(eventType, onTrigger)
          switch (eventType) {
            case 'mouseenter':
              on('mouseleave', onMouseLeave)
              break
            case 'focus':
              on(isIE ? 'focusout' : 'blur', onBlur)
              break
          }
        } else {
          // Delegates
          switch (eventType) {
            case 'mouseenter':
              on('mouseover', onDelegateShow)
              on('mouseout', onDelegateHide)
              break
            case 'focus':
              on('focusin', onDelegateShow)
              on('focusout', onDelegateHide)
              break
            case 'click':
              on(eventType, onDelegateShow)
              break
          }
        }
      })
  }

  /**
   * Removes event listeners from the reference
   */
  function removeTriggersFromReference() {
    listeners.forEach(({ eventType, handler, options }) => {
      instance.reference.removeEventListener(eventType, handler, options)
    })
    listeners = []
  }

  /**
   * Returns inner elements used in show/hide methods
   * @return {HTMLDivElement[]}
   */
  function getInnerElements() {
    return [
      instance.popperChildren.tooltip,
      instance.popperChildren.backdrop,
      instance.popperChildren.content,
    ]
  }

  /* ======================= 🔑 Public methods 🔑 ======================= */
  /**
   * Enables the instance to allow it to show or hide
   */
  function enable() {
    instance.state.isEnabled = true
  }

  /**
   * Disables the instance to disallow it to show or hide
   */
  function disable() {
    instance.state.isEnabled = false
  }

  /**
   * Clears pending timeouts related to the `delay` prop if any
   */
  function clearDelayTimeouts() {
    clearTimeout(showTimeoutId)
    clearTimeout(hideTimeoutId)
  }

  /**
   * Sets new props for the instance and redraws the tooltip
   * @param {Object} options
   */
  function set(options = {}) {
    validateOptions(options, Defaults)

    const prevProps = instance.props
    const nextProps = evaluateProps(instance.reference, {
      ...instance.props,
      ...options,
      ignoreAttributes: true,
    })
    nextProps.ignoreAttributes = hasOwnProperty(options, 'ignoreAttributes')
      ? options.ignoreAttributes
      : prevProps.ignoreAttributes
    instance.props = nextProps

    if (
      hasOwnProperty(options, 'trigger') ||
      hasOwnProperty(options, 'touchHold')
    ) {
      removeTriggersFromReference()
      addTriggersToReference()
    }

    if (hasOwnProperty(options, 'interactiveDebounce')) {
      cleanupOldMouseListeners()
      debouncedOnMouseMove = debounce(onMouseMove, options.interactiveDebounce)
    }

    updatePopperElement(instance.popper, prevProps, nextProps)
    instance.popperChildren = getChildren(instance.popper)

    if (instance.popperInstance) {
      instance.popperInstance.update()

      if (
        POPPER_INSTANCE_DEPENDENCIES.some(prop => hasOwnProperty(options, prop))
      ) {
        instance.popperInstance.destroy()
        createPopperInstance()
        if (!instance.state.isVisible) {
          instance.popperInstance.disableEventListeners()
        }
        if (instance.props.followCursor && lastMouseMoveEvent) {
          positionVirtualReferenceNearCursor(lastMouseMoveEvent)
        }
      }
    }
  }

  /**
   * Shortcut for .set({ content: newContent })
   * @param {String|Element|Function} content
   */
  function setContent(content) {
    set({ content })
  }

  /**
   * Shows the tooltip
   * @param {Number} duration
   */
  function show(
    duration = getValue(instance.props.duration, 0, Defaults.duration[0]),
  ) {
    if (
      instance.state.isDestroyed ||
      !instance.state.isEnabled ||
      (isUsingTouch && !instance.props.touch)
    ) {
      return
    }

    // Destroy tooltip if the reference element is no longer on the DOM
    if (
      // @ts-ignore
      !hasOwnProperty(instance.reference, 'isVirtual') &&
      !document.documentElement.contains(instance.reference)
    ) {
      return destroy()
    }

    // Do not show tooltip if the reference element has a `disabled` attribute
    if (instance.reference.hasAttribute('disabled')) {
      return
    }

    if (instance.props.onShow(instance) === false) {
      return
    }

    instance.popper.style.visibility = 'visible'
    instance.state.isVisible = true

    if (instance.props.interactive) {
      instance.reference.classList.add('tippy-active')
    }

    // Prevent a transition if the popper is at the opposite placement
    applyTransitionDuration(
      [
        instance.popper,
        instance.popperChildren.tooltip,
        instance.popperChildren.backdrop,
      ],
      0,
    )

    mount(() => {
      if (!instance.state.isVisible) {
        return
      }

      // Arrow will sometimes not be positioned correctly. Force another update
      if (!hasFollowCursorBehavior()) {
        instance.popperInstance.update()
      }

      applyTransitionDuration([instance.popper], props.updateDuration)
      applyTransitionDuration(getInnerElements(), duration)

      if (instance.popperChildren.backdrop) {
        instance.popperChildren.content.style.transitionDelay =
          Math.round(duration / 12) + 'ms'
      }

      if (instance.props.sticky) {
        makeSticky()
      }

      setVisibilityState(getInnerElements(), 'visible')

      onTransitionedIn(duration, () => {
        instance.popperChildren.tooltip.classList.add('tippy-notransition')

        if (instance.props.aria) {
          instance.reference.setAttribute(
            `aria-${instance.props.aria}`,
            instance.popper.id,
          )
        }

        instance.props.onShown(instance)
        instance.state.isShown = true
      })
    })
  }

  /**
   * Hides the tooltip
   * @param {Number} duration
   */
  function hide(
    duration = getValue(instance.props.duration, 1, Defaults.duration[1]),
  ) {
    if (instance.state.isDestroyed || !instance.state.isEnabled) {
      return
    }

    if (instance.props.onHide(instance) === false) {
      return
    }

    instance.popperChildren.tooltip.classList.remove('tippy-notransition')

    if (instance.props.interactive) {
      instance.reference.classList.remove('tippy-active')
    }

    instance.popper.style.visibility = 'hidden'
    instance.state.isVisible = false
    instance.state.isShown = false

    applyTransitionDuration(getInnerElements(), duration)

    setVisibilityState(getInnerElements(), 'hidden')

    onTransitionedOut(duration, () => {
      if (!isScheduledToShow) {
        removeFollowCursorListener()
      }

      if (instance.props.aria) {
        instance.reference.removeAttribute(`aria-${instance.props.aria}`)
      }

      instance.popperInstance.disableEventListeners()
      instance.popperInstance.options.placement = instance.props.placement

      parentNode.removeChild(instance.popper)
      instance.props.onHidden(instance)
      instance.state.isMounted = false
    })
  }

  /**
   * Destroys the tooltip
   * @param {Boolean} [destroyTargetInstances]
   */
  function destroy(destroyTargetInstances) {
    if (instance.state.isDestroyed) {
      return
    }

    // If the popper is currently mounted to the DOM, we want to ensure it gets
    // hidden and unmounted instantly upon destruction
    if (instance.state.isMounted) {
      hide(0)
    }

    removeTriggersFromReference()

    // @ts-ignore
    delete instance.reference._tippy

    if (instance.props.target && destroyTargetInstances) {
      arrayFrom(
        instance.reference.querySelectorAll(instance.props.target),
      ).forEach(child => {
        if (child._tippy) {
          child._tippy.destroy()
        }
      })
    }

    if (instance.popperInstance) {
      instance.popperInstance.destroy()
    }

    instance.state.isDestroyed = true
  }
}

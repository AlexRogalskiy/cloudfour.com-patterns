import path from 'path';

import type { ElementHandle, PleasantestUtils } from 'pleasantest';
import { getAccessibilityTree, withBrowser } from 'pleasantest';

import { loadGlobalCSS, loadTwigTemplate } from '../../../test-utils.js';

// Helper to load the Twig template file
const componentMarkup = (args = {}) =>
  loadTwigTemplate(path.join(__dirname, './subscribe.twig'))({
    form_id: 'example-form',
    ...args,
  });
// Helper to load the demo Twig template file
const demoMarkup = loadTwigTemplate(path.join(__dirname, './demo/demo.twig'));
const demoDestroyInitMarkup = loadTwigTemplate(
  path.join(__dirname, './demo/destroy-init.twig')
);

/**
 * Helper function that checks the `clientHeight` and `clientWidth` of
 * a given element, expects dimensions to be smaller than or equal to `1`
 * meaning the element is visually hidden.
 */
const expectElementToBeVisuallyHidden = async (
  element: ElementHandle<HTMLElement>
) => {
  const { elHeight, elWidth } = await element.evaluate((el: HTMLElement) => ({
    elHeight: el.clientHeight,
    elWidth: el.clientWidth,
  }));
  expect(elHeight).toBeLessThanOrEqual(1);
  expect(elWidth).toBeLessThanOrEqual(1);
};

/**
 * Helper function that checks the `clientHeight` and `clientWidth` of
 * given element, expects dimensions to be greater than or equal to `1`
 * meaning the element is not visually hidden.
 */
const expectElementNotToBeVisuallyHidden = async (
  form: ElementHandle<HTMLElement>
) => {
  const { elHeight, elWidth } = await form.evaluate((el: HTMLElement) => ({
    elHeight: el.clientHeight,
    elWidth: el.clientWidth,
  }));

  expect(elHeight).toBeGreaterThan(1);
  expect(elWidth).toBeGreaterThan(1);
};

// Helper to initialize the component JS
const initJS = (utils: PleasantestUtils) =>
  utils.runJS(`
    import { createSubscribe } from './subscribe';
    const subscribe = createSubscribe(
      document.querySelector('.js-subscribe')
    );
    subscribe.init();
  `);

describe('Subscription component', () => {
  test(
    'should use semantic markup',
    withBrowser(async ({ utils, page }) => {
      await loadGlobalCSS(utils);
      await utils.loadCSS('./subscribe.scss');
      await utils.injectHTML(
        await componentMarkup({
          weekly_digests_heading: 'Get Weekly Digests',
          subscribe_heading: 'Never miss an article!',
        })
      );
      await initJS(utils);

      expect(await getAccessibilityTree(page)).toMatchInlineSnapshot(`
        document "pleasantest"
          heading "Never miss an article!" (level=2)
            text "Never miss an article!"
          status
            text "Notifications have been turned off."
          button "Get notifications"
          link "Get Weekly Digests"
            text "Get Weekly Digests"
          form "Get Weekly Digests"
            heading "Get Weekly Digests" (level=2)
              text "Get Weekly Digests"
            text "Email"
            textbox "Email"
            button "Subscribe"
      `);
    })
  );

  test(
    'should be keyboard accessible',
    withBrowser(async ({ utils, screen, waitFor, page }) => {
      await loadGlobalCSS(utils);
      await utils.loadCSS('./subscribe.scss');
      await utils.injectHTML(await demoMarkup());
      await initJS(utils);

      // Confirm the form is visually hidden by default
      const form = await screen.getByRole('form', {
        name: 'Get Weekly Digests',
      });
      await expectElementToBeVisuallyHidden(form);

      // Tab all the way to the form email input
      await page.keyboard.press('Tab'); // Notifications button
      await page.keyboard.press('Tab'); // Weekly Digests link
      await page.keyboard.press('Tab'); // Email input

      // Confirm the form is now "active" (not visually hidden)
      await expectElementNotToBeVisuallyHidden(form);

      // Email input should be in focus
      const emailInput = await screen.getByRole('textbox', { name: 'Email' });
      await expect(emailInput).toHaveFocus();

      // Tab again to get to the Submit button
      await page.keyboard.press('Tab');

      // Submit button should be in focus
      const subscribeBtn = await screen.getByRole('button', {
        name: 'Subscribe',
      });
      await expect(subscribeBtn).toHaveFocus();

      // Confirm the form is still "active" (not visually hidden)
      await expectElementNotToBeVisuallyHidden(form);

      // Navigate back up to the Weekly Digests link
      await page.keyboard.down('Shift'); // Navigate backwards
      await page.keyboard.press('Tab'); // Email input
      await page.keyboard.press('Tab'); // Weekly Digests link
      await page.keyboard.up('Shift'); // Release Shift key

      // Confirm the focus has moved to the Weekly Digests link
      const weeklyDigestsBtn = await screen.getByRole('link', {
        name: 'Get Weekly Digests',
      });
      await expect(weeklyDigestsBtn).toHaveFocus();

      // The form should now be visually hidden again
      await expectElementToBeVisuallyHidden(form);

      // Navigate forward past the Submit to activate the form hide timeout
      await page.keyboard.press('Tab'); // Email input
      await page.keyboard.press('Tab'); // Submit button
      await page.keyboard.press('Tab'); // Out of the form

      // Confirm the form is still "active" (not visually hidden)
      await expectElementNotToBeVisuallyHidden(form);

      // Navigate back quickly to confirm timeout getting cancelled
      await page.keyboard.down('Shift'); // Navigate backwards
      await page.keyboard.press('Tab'); // Submit button
      await page.keyboard.up('Shift'); // Release Shift key

      // Confirm the form is still "active" (not visually hidden)
      await expectElementNotToBeVisuallyHidden(form);

      await page.keyboard.press('Tab'); // Out of the form

      // Confirm the form is still "active" (not visually hidden)
      await expectElementNotToBeVisuallyHidden(form);

      // After a timeout, the form eventually visually hides
      await waitFor(
        async () => {
          await expectElementToBeVisuallyHidden(form);
        },
        {
          timeout: 2000,
          interval: 1000,
        }
      );

      // Navigate back into the form
      await page.keyboard.down('Shift'); // Navigate backwards
      await page.keyboard.press('Tab'); // Submit button
      await page.keyboard.up('Shift'); // Release Shift key

      // Confirm the form is "active" again (not visually hidden)
      await expectElementNotToBeVisuallyHidden(form);

      // Should hide the form
      await page.keyboard.press('Escape');

      // Confirm the form should is visually hidden
      await expectElementToBeVisuallyHidden(form);

      // The focus should reset back to the "weekly digests" link
      await expect(weeklyDigestsBtn).toHaveFocus();
    })
  );

  test(
    'should be customizable',
    withBrowser(async ({ utils, screen }) => {
      // Set up CSS
      await loadGlobalCSS(utils);
      await utils.loadCSS('./subscribe.scss');

      // No customization
      await utils.injectHTML(await componentMarkup({ form_id: 'test' }));

      // Confirm default heading tags are not set
      const anyHeading = await screen.queryByRole('heading');
      expect(anyHeading).not.toBeInTheDocument();

      // Confirm default form values
      let emailInput = await screen.getByRole('textbox', { name: 'Email' });
      expect(emailInput).toHaveAttribute('placeholder', 'Your Email Address');

      // Customize the component
      await utils.injectHTML(
        await componentMarkup({
          form_id: 'test',
          form_action: 'test-action.com',
          heading_tag: 'h3',
          weekly_digests_heading: 'Weekly digests available',
          subscribe_heading: "Don't miss out!",
          notifications_btn_class: 'hello',
          notifications_btn_initial_visual_label: 'Yes to notifications',
          weekly_digests_btn_class: 'world',
          weekly_digests_btn_label: 'I want weekly digests',
          email_input_name: 'email-input-name',
          email_input_placeholder: 'Gimme email',
          submit_btn_label: 'Sign up',
        })
      );

      // Confirm custom headings
      await screen.getByRole('heading', {
        name: 'Weekly digests available',
        level: 3,
      });
      await screen.getByRole('heading', {
        name: "Don't miss out!",
        level: 3,
      });

      // Confirm custom form values
      const form = await screen.getByRole('form', {
        name: 'Weekly digests available',
      });
      expect(form).toHaveAttribute('action', 'test-action.com');
      emailInput = await screen.getByRole('textbox', { name: 'Email' });
      expect(emailInput).toHaveAttribute('placeholder', 'Gimme email');
      expect(emailInput).toHaveAttribute('name', 'email-input-name');

      // Confirm custom notifications button
      const notificationsBtn = await screen.getByRole('button', {
        name: 'Yes to notifications',
      });
      await expect(notificationsBtn).toHaveClass('hello');

      // Confirm custom weekly digests link
      const weeklyDigestsLink = await screen.getByRole('link', {
        name: 'I want weekly digests',
      });
      await expect(weeklyDigestsLink).toHaveClass('world');

      // Confirm custom weekly digests submit button
      await screen.getByRole('button', {
        name: 'Sign up',
      });
    })
  );

  test(
    'should destroy and initialize',
    withBrowser(async ({ utils, screen, waitFor, page }) => {
      await loadGlobalCSS(utils);
      await utils.loadCSS('./subscribe.scss');
      await utils.injectHTML(await demoDestroyInitMarkup());
      await utils.runJS(`
        import { createSubscribe } from './subscribe';
        // We attach it to the window object as a workaround to have access to
        // the subscribeComponent later in this test.
        window.subscribeComponent = createSubscribe(
          document.querySelector('.js-subscribe')
        );
        // Set it to the "destroyed" state
        window.subscribeComponent.destroy();
      `);

      // The form should be active/visible when `destroy()` is called
      const form = await screen.getByRole('form', {
        name: 'Get Weekly Digests',
      });
      await expectElementNotToBeVisuallyHidden(form);

      // Tab all the way to the "testing" link
      await page.keyboard.press('Tab'); // Email input
      await page.keyboard.press('Tab'); // Subscribe button
      await page.keyboard.press('Tab'); // "Testing" link

      // The "testing" link should be in focus
      const testingLink = await screen.getByRole('link', {
        name: 'Testing link',
      });
      await expect(testingLink).toHaveFocus();

      // After a timeout, the form should not visually hide
      await new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });
      await expectElementNotToBeVisuallyHidden(form);

      // Initialize the Subscribe component
      await utils.runJS(`
        window.subscribeComponent.init();
      `);

      // The form should be visually hidden after `init()` is called
      await expectElementToBeVisuallyHidden(form);

      // Navigate back into the form
      await page.keyboard.down('Shift'); // Navigate backwards
      await page.keyboard.press('Tab'); // Form Subscribe submit button
      await page.keyboard.up('Shift'); // Release Shift key

      // The form should be visible when you move the focus back into the form
      await expectElementNotToBeVisuallyHidden(form);

      // Navigate away from the form
      await page.keyboard.press('Tab'); // "Testing" link

      // Immediately, the form should stay visible
      await expectElementNotToBeVisuallyHidden(form);

      // After a timeout, the form eventually visually hides
      await waitFor(
        async () => {
          await expectElementToBeVisuallyHidden(form);
        },
        {
          timeout: 2000,
          interval: 1000,
        }
      );

      // Cover a race condition where the timeout and destroy get called quickly
      // one after the other causing an unexpected UI state when the Subscribe
      // component timeout isn't cleared.
      // Set the focus in the form first (on the submit button)
      const formSubmitBtn = await screen.getByRole('button', {
        name: 'Subscribe',
      });
      formSubmitBtn.focus();
      // Then blur the focus
      await formSubmitBtn.evaluate((btn) => btn.blur());
      // And immediately run the `destroy()`
      await utils.runJS(`
        window.subscribeComponent.destroy();
      `);
      // Wait out the Subscribe component timeout
      await new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });
      // The form should be visible
      await expectElementNotToBeVisuallyHidden(form);
    })
  );
});

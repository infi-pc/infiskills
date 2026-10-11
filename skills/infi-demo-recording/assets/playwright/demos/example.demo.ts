import { demoTest, expect, beat, title, glideClick } from "./kit";

// Self-contained kit demonstration. Replace with the target application's flow.
demoTest("recording kit example", async ({ page }) => {
  const html = `<html><body style="font:24px system-ui;padding:120px">
    <h1>A narrated walkthrough</h1>
    <button onclick="document.querySelector('output').textContent='Complete'"
      style="font:inherit;padding:16px">Continue</button>
    <output style="display:block;margin-top:30px">Ready</output>
  </body></html>`;
  await page.goto(`data:text/html,${encodeURIComponent(html)}`);
  await title({ caption: "A clear feature walkthrough" });
  await beat({
    caption: "The action completes successfully",
    say: "Let's continue to the next step.",
    action: async ({ narrate }) => {
      await glideClick(page.getByRole("button", { name: "Continue" }));
      await expect(page.locator("output")).toHaveText("Complete");
      await narrate("The result is now visible.");
    },
  });
  await title({ caption: "The flow is complete" });
});

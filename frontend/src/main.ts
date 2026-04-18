import { initAuth, supabase } from './auth';
import { renderDashboard } from './ui/dashboard';

const app = document.querySelector('#app')!;

async function renderLogin() {
  app.innerHTML = `
    <div style="padding: 40px 20px; text-align: center;">
      <h1>Car Manager v2</h1>
      <p style="color: #666;">Sign in to continue</p>
      <form id="login-form" style="display: flex; flex-direction: column; gap: 12px; max-width: 320px; margin: 40px auto 0;">
        <input type="email" id="email" placeholder="Email" required style="padding: 12px; border-radius: 8px; border: 1px solid #333; background: #1a1a1a; color: #fff;">
        <input type="password" id="password" placeholder="Password" required style="padding: 12px; border-radius: 8px; border: 1px solid #333; background: #1a1a1a; color: #fff;">
        <button type="submit" style="padding: 14px; border-radius: 8px; border: none; background: #4da6ff; color: #000; font-weight: 700; cursor: pointer;">Sign In</button>
      </form>
      <div id="login-error" style="color: #cf6679; margin-top: 16px; font-size: 0.85rem; display: none;"></div>
    </div>
  `;

  const form = document.querySelector('#login-form') as HTMLFormElement;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (document.querySelector('#email') as HTMLInputElement).value;
    const password = (document.querySelector('#password') as HTMLInputElement).value;
    const errorEl = document.querySelector('#login-error') as HTMLDivElement;
    
    const btn = form.querySelector('button')!;
    btn.disabled = true;
    btn.textContent = 'Signing in...';
    errorEl.style.display = 'none';

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      errorEl.textContent = error.message;
      errorEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });
}

// Initial Auth check
initAuth((session) => {
  if (session) {
    renderDashboard(app as HTMLElement);
  } else {
    renderLogin();
  }
});

// Exclusão de conta pela web (Google Play; plano, seção 18, item 20). Confirma o e-mail com o
// código do Supabase Auth, sem criar conta nova, e chama a mesma função excluir-conta do app.
// URL e chave publicável são públicas por natureza e vêm de apps/serpfix/src/config/supabase.ts
// na publicação (scripts/publicar-site.mjs).
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm';

const supabase = createClient('https://newcsazqfvqhzcgihysy.supabase.co', 'sb_publishable_vEe4__-RSIoJYON-99_VBA_QM3T1KJF', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const $ = (id) => document.getElementById(id);
const etapas = ['etapa-email', 'etapa-codigo', 'etapa-excluir', 'etapa-feito'];
let emailAtual = '';

function mostrar(etapa) {
  for (const id of etapas) $(id).hidden = id !== etapa;
  const foco = { 'etapa-email': 'email', 'etapa-codigo': 'codigo', 'etapa-excluir': 'ciente' }[etapa];
  if (foco) $(foco).focus();
}

function avisar(texto, tipo = 'erro') {
  const caixa = $('mensagem');
  caixa.textContent = texto;
  caixa.className = `mensagem ${tipo}`;
  caixa.hidden = !texto;
}

function ocupado(botao, sim) {
  botao.disabled = sim;
  botao.setAttribute('aria-busy', sim ? 'true' : 'false');
}

$('form-email').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const email = $('email').value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    avisar('Confira o e-mail digitado.');
    return;
  }
  avisar('');
  ocupado($('enviar-codigo'), true);
  // shouldCreateUser: false — esta página nunca cria conta. A resposta é a mesma exista ou não a
  // conta, para a página não revelar quem usa o SerpFix. O retorno nesta página faz o Auth mandar
  // o e-mail de confirmação da exclusão, só com o código (scripts/modelos-email.mjs).
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: new URL('excluir-conta.html', location.href).href },
  });
  ocupado($('enviar-codigo'), false);
  if (error && /rate|too many|security purposes/i.test(error.message)) {
    avisar('Muitos pedidos seguidos. Espere um minuto e tente de novo.');
    return;
  }
  emailAtual = email;
  $('texto-codigo').textContent = `Se existir uma conta do SerpFix com ${email}, o código chega em instantes. Olhe também o spam.`;
  mostrar('etapa-codigo');
});

$('outro-email').addEventListener('click', () => {
  avisar('');
  $('codigo').value = '';
  mostrar('etapa-email');
});

$('form-codigo').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const codigo = $('codigo').value.replace(/\D/g, '');
  if (codigo.length < 6) {
    avisar('Digite o código que veio no e-mail.');
    return;
  }
  avisar('');
  ocupado($('confirmar-codigo'), true);
  const { error } = await supabase.auth.verifyOtp({ email: emailAtual, token: codigo, type: 'email' });
  ocupado($('confirmar-codigo'), false);
  if (error) {
    avisar('Código vencido ou incorreto. Confira o último e-mail ou peça um novo.');
    return;
  }
  $('email-confirmado').textContent = emailAtual;
  $('ciente').checked = false;
  $('excluir').disabled = true;
  mostrar('etapa-excluir');
});

$('ciente').addEventListener('change', () => {
  $('excluir').disabled = !$('ciente').checked;
});

$('cancelar').addEventListener('click', async () => {
  await supabase.auth.signOut({ scope: 'local' });
  avisar('Nada foi excluído.', 'ok');
  mostrar('etapa-email');
});

$('excluir').addEventListener('click', async () => {
  ocupado($('excluir'), true);
  const { error } = await supabase.functions.invoke('excluir-conta', { method: 'POST' });
  if (error) {
    ocupado($('excluir'), false);
    avisar('Não foi possível excluir agora. Tente de novo em instantes; se continuar, escreva para o contato abaixo.');
    return;
  }
  await supabase.auth.signOut({ scope: 'local' });
  avisar('');
  mostrar('etapa-feito');
});

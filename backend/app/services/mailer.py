"""Servicio de envío de emails vía SMTP.

Config viene de public.system_settings — el admin la edita desde
Configuración → Correo (SMTP). Sin dependencias externas: usa smtplib
stdlib. Si el admin no configuró SMTP, send_mail() lanza HTTPException 503
con mensaje claro.

Uso típico:
    send_mail(to='alguien@x.com', subject='...', html='<h1>Hola</h1>')

Templates: por ahora inline en los callers (invitación, reset). Cuando
tengamos 3+ templates, mover a jinja2.
"""
import logging
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from typing import Dict, Optional

from fastapi import HTTPException, status

from app.database import get_db

logger = logging.getLogger(__name__)

# Keys en system_settings — mismos nombres que la migration V016.
_SMTP_KEYS = (
    "smtp_host", "smtp_port", "smtp_user", "smtp_password",
    "smtp_from", "smtp_use_tls", "smtp_reject_unauthorized",
)


def _load_smtp_config() -> Dict[str, str]:
    """Lee todos los settings SMTP en un solo query. Retorna dict con str."""
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT key, COALESCE(value,'') AS value FROM public.system_settings"
            " WHERE key = ANY(%s);",
            (list(_SMTP_KEYS),),
        )
        return {r["key"]: r["value"] for r in cur.fetchall()}


def _bool(s: str) -> bool:
    return s.strip().lower() in ("true", "1", "yes", "y", "on")


def is_smtp_configured() -> bool:
    """Chequeo rápido: ¿hay al menos host + user + password? Sin esto no
    intentamos enviar (evita traces feos por config vacía)."""
    cfg = _load_smtp_config()
    return bool(cfg.get("smtp_host") and cfg.get("smtp_user") and cfg.get("smtp_password"))


def send_mail(
    to: str,
    subject: str,
    html: str,
    text: Optional[str] = None,
) -> None:
    """Envía un email. Bloqueante — el caller decide si spawnear background.

    Raises:
        HTTPException 503 — si SMTP no está configurado.
        HTTPException 502 — si el envío falla (network, auth, cert).
    """
    cfg = _load_smtp_config()
    host = cfg.get("smtp_host")
    if not host or not cfg.get("smtp_user"):
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "El servidor de correo no está configurado. Configura SMTP en "
            "Configuración → Correo antes de enviar invitaciones.",
        )

    try:
        port = int(cfg.get("smtp_port") or "587")
    except ValueError:
        port = 587

    user = cfg["smtp_user"]
    password = cfg.get("smtp_password") or ""
    from_addr = cfg.get("smtp_from") or user
    use_tls = _bool(cfg.get("smtp_use_tls") or "true")
    reject_unauth = _bool(cfg.get("smtp_reject_unauthorized") or "true")

    # Construir mensaje MIME
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = formataddr(("Tareo", from_addr))
    msg["To"] = to
    if text:
        msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    # SSL context — si reject_unauth=false, aceptamos self-signed (útil
    # para servidores corporativos con cert interno).
    ctx = ssl.create_default_context()
    if not reject_unauth:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

    try:
        # 465 → SMTP_SSL puro. 587/otros → SMTP + STARTTLS si use_tls.
        if port == 465:
            with smtplib.SMTP_SSL(host, port, context=ctx, timeout=15) as srv:
                srv.login(user, password)
                srv.sendmail(from_addr, [to], msg.as_string())
        else:
            with smtplib.SMTP(host, port, timeout=15) as srv:
                srv.ehlo()
                if use_tls:
                    srv.starttls(context=ctx)
                    srv.ehlo()
                srv.login(user, password)
                srv.sendmail(from_addr, [to], msg.as_string())
    except smtplib.SMTPAuthenticationError as e:
        logger.error("SMTP auth failed for %s: %s", user, e)
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "Autenticación SMTP falló. Verifica usuario/contraseña "
            "(si usas Gmail, necesitas una 'app password').",
        )
    except (smtplib.SMTPException, OSError, ssl.SSLError) as e:
        logger.error("SMTP send failed to %s: %s", to, e)
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"No se pudo enviar el email: {type(e).__name__}. "
            f"Revisa la configuración SMTP y que el servidor sea accesible.",
        )


# ─── Test connection ─────────────────────────────────────────────────────

def test_smtp_connection(sample_to: str) -> None:
    """Envía un email de prueba al `sample_to` provisto (típicamente el
    email del admin). Usa la config actual de SMTP. Reusa send_mail para
    que el path sea idéntico al de producción."""
    html = """
    <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;padding:24px">
      <h2 style="color:#1E40AF;margin:0 0 12px">Prueba de envío ✓</h2>
      <p>Si estás leyendo esto, la configuración SMTP de Azoramind Tareo está funcionando correctamente.</p>
      <p style="color:#64748b;font-size:12px;margin-top:24px">
        Este email fue disparado desde <strong>Configuración → Correo → Probar envío</strong>.
      </p>
    </div>
    """
    text = "Prueba de envío OK. La configuración SMTP de Azoramind Tareo funciona correctamente."
    send_mail(to=sample_to, subject="[Tareo] Prueba de envío SMTP", html=html, text=text)

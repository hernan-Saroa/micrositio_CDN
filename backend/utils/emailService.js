/**
 * Servicio de Email - VIITS INVIAS
 * Utiliza Nodemailer para envío de correos electrónicos
 */

const nodemailer = require('nodemailer');
const logger = require('./logger');

/**
 * Configuración del transportador de email
 */
const createTransporter = () => {

    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        // Configuración adicional para Gmail
        tls: {
            rejectUnauthorized: false
        }
    });
};

/**
 * Enviar email genérico
 * @param {string} to - Destinatario
 * @param {string} subject - Asunto
 * @param {string} html - Contenido HTML
 * @param {string} text - Contenido texto plano (opcional)
 */
const sendEmail = async (to, subject, html, text = null) => {
    try {
        const transporter = createTransporter();

        const mailOptions = {
            from: `"VIITS - INVIAS" <${process.env.EMAIL_USER}>`,
            to: to,
            subject: subject,
            html: html
        };

        if (text) {
            mailOptions.text = text;
        }

        const info = await transporter.sendMail(mailOptions);

        logger.info(`Email enviado exitosamente a ${to}: ${info.messageId}`);

        return {
            success: true,
            messageId: info.messageId,
            response: info.response
        };

    } catch (error) {
        logger.error(`Error al enviar email a ${to}:`, error);
        throw new Error(`Error al enviar email: ${error.message}`);
    }
};

/**
 * Enviar código de verificación
 * @param {string} to - Email del destinatario
 * @param {string} verificationCode - Código de 6 dígitos
 * @param {string} userName - Nombre del usuario
 */
const sendVerificationCode = async (to, verificationCode, userName) => {
    const subject = 'Código de Verificación - VIITS INVIAS';

    const html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Código de Verificación - VIITS</title>
            <style>
                body {
                    font-family: 'Work Sans', Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    background-color: #f8fafc;
                    padding: 20px;
                }
                .container {
                    background: white;
                    padding: 30px;
                    border-radius: 12px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 3px solid #f97316;
                    padding-bottom: 20px;
                }
                .logo {
                    font-size: 24px;
                    font-weight: bold;
                    color: #f97316;
                    margin-bottom: 10px;
                }
                .title {
                    font-size: 20px;
                    font-weight: 600;
                    color: #1f2937;
                    margin-bottom: 10px;
                }
                .code-container {
                    background: #f3f4f6;
                    border: 2px dashed #f97316;
                    border-radius: 8px;
                    padding: 20px;
                    text-align: center;
                    margin: 30px 0;
                }
                .verification-code {
                    font-size: 32px;
                    font-weight: bold;
                    color: #f97316;
                    letter-spacing: 4px;
                    font-family: 'Courier New', monospace;
                    margin: 0;
                }
                .instructions {
                    margin: 20px 0;
                    color: #6b7280;
                }
                .warning {
                    background: #fef3c7;
                    border-left: 4px solid #f59e0b;
                    padding: 15px;
                    margin: 20px 0;
                    border-radius: 4px;
                }
                .footer {
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #e5e7eb;
                    text-align: center;
                    font-size: 14px;
                    color: #6b7280;
                }
                .footer p {
                    margin: 5px 0;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🚛 VIITS</div>
                    <h1 class="title">Verificación de Seguridad</h1>
                    <p>Instituto Nacional de Vías - INVIAS</p>
                </div>

                <p>Hola <strong>${userName}</strong>,</p>

                <p>Has solicitado acceso a los datos del Sistema de Vigilancia Inteligente de Infraestructura de Transporte y Seguridad (VIITS).</p>

                <p>Para continuar con tu solicitud, utiliza el siguiente código de verificación:</p>

                <div class="code-container">
                    <div class="verification-code">${verificationCode}</div>
                </div>

                <div class="instructions">
                    <p><strong>Instrucciones:</strong></p>
                    <ul style="text-align: left; margin: 10px 0;">
                        <li>Ingresa este código de 6 dígitos en el formulario de verificación</li>
                        <li>El código expira en 5 minutos</li>
                        <li>No compartas este código con nadie</li>
                    </ul>
                </div>

                <div class="warning">
                    <strong>⚠️ Importante:</strong> Si no solicitaste este código, por favor ignora este mensaje.
                </div>

                <div class="footer">
                    <p><strong>VIITS - Sistema de Vigilancia Inteligente</strong></p>
                    <p>Instituto Nacional de Vías (INVIAS) - Colombia</p>
                    <p>Este es un mensaje automático, por favor no respondas a este correo.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    const text = `
        Código de Verificación VIITS - INVIAS

        Hola ${userName},

        Tu código de verificación es: ${verificationCode}

        Este código expira en 5 minutos.

        Si no solicitaste este código, ignora este mensaje.

        VIITS - Instituto Nacional de Vías (INVIAS)
    `;

    return await sendEmail(to, subject, html, text);
};

/**
 * Enviar token de restablecimiento de contraseña
 * @param {string} to - Email del destinatario
 * @param {string} resetToken - Token de 6 dígitos
 * @param {string} userName - Nombre del usuario
 */
const sendPasswordResetToken = async (to, resetToken, userName) => {
    const subject = 'Restablecimiento de Contraseña - VIITS INVIAS';

    const html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Restablecimiento de Contraseña - VIITS</title>
            <style>
                body {
                    font-family: 'Work Sans', Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    background-color: #f8fafc;
                    padding: 20px;
                }
                .container {
                    background: white;
                    padding: 30px;
                    border-radius: 12px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 3px solid #ef4444;
                    padding-bottom: 20px;
                }
                .logo {
                    font-size: 24px;
                    font-weight: bold;
                    color: #ef4444;
                    margin-bottom: 10px;
                }
                .title {
                    font-size: 20px;
                    font-weight: 600;
                    color: #1f2937;
                    margin-bottom: 10px;
                }
                .code-container {
                    background: #f3f4f6;
                    border: 2px dashed #ef4444;
                    border-radius: 8px;
                    padding: 20px;
                    text-align: center;
                    margin: 30px 0;
                }
                .reset-token {
                    font-size: 32px;
                    font-weight: bold;
                    color: #ef4444;
                    letter-spacing: 4px;
                    font-family: 'Courier New', monospace;
                    margin: 0;
                }
                .instructions {
                    margin: 20px 0;
                    color: #6b7280;
                }
                .warning {
                    background: #fef3c7;
                    border-left: 4px solid #f59e0b;
                    padding: 15px;
                    margin: 20px 0;
                    border-radius: 4px;
                }
                .footer {
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #e5e7eb;
                    text-align: center;
                    font-size: 14px;
                    color: #6b7280;
                }
                .footer p {
                    margin: 5px 0;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🔐 VIITS</div>
                    <h1 class="title">Restablecimiento de Contraseña</h1>
                    <p>Instituto Nacional de Vías - INVIAS</p>
                </div>

                <p>Hola <strong>${userName}</strong>,</p>

                <p>Has solicitado restablecer tu contraseña para el Sistema de Vigilancia Inteligente de Infraestructura de Transporte y Seguridad (VIITS).</p>

                <p>Utiliza el siguiente código de restablecimiento:</p>

                <div class="code-container">
                    <div class="reset-token">${resetToken}</div>
                </div>

                <div class="instructions">
                    <p><strong>Instrucciones:</strong></p>
                    <ul style="text-align: left; margin: 10px 0;">
                        <li>Ingresa este código de 6 dígitos en el formulario de restablecimiento</li>
                        <li>El código expira en 15 minutos</li>
                        <li>No compartas este código con nadie</li>
                    </ul>
                </div>

                <div class="warning">
                    <strong>⚠️ Importante:</strong> Si no solicitaste este restablecimiento, por favor ignora este mensaje y contacta al administrador.
                </div>

                <div class="footer">
                    <p><strong>VIITS - Sistema de Vigilancia Inteligente</strong></p>
                    <p>Instituto Nacional de Vías (INVIAS) - Colombia</p>
                    <p>Este es un mensaje automático, por favor no respondas a este correo.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    const text = `
        Restablecimiento de Contraseña VIITS - INVIAS

        Hola ${userName},

        Tu código de restablecimiento es: ${resetToken}

        Este código expira en 15 minutos.

        Si no solicitaste este restablecimiento, ignora este mensaje.

        VIITS - Instituto Nacional de Vías (INVIAS)
    `;

    return await sendEmail(to, subject, html, text);
};

/**
 * Enviar confirmación de descarga
 * @param {string} to - Email del destinatario
 * @param {string} userName - Nombre del usuario
 * @param {string} requestId - ID de la solicitud
 */
const sendDownloadConfirmation = async (to, userName, requestId) => {
    const subject = 'Confirmación de Solicitud de Datos - VIITS INVIAS';

    const html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Confirmación de Solicitud - VIITS</title>
            <style>
                body {
                    font-family: 'Work Sans', Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    background-color: #f8fafc;
                    padding: 20px;
                }
                .container {
                    background: white;
                    padding: 30px;
                    border-radius: 12px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 3px solid #10b981;
                    padding-bottom: 20px;
                }
                .logo {
                    font-size: 24px;
                    font-weight: bold;
                    color: #10b981;
                    margin-bottom: 10px;
                }
                .success-icon {
                    font-size: 48px;
                    color: #10b981;
                    margin-bottom: 15px;
                }
                .request-id {
                    background: #f3f4f6;
                    padding: 15px;
                    border-radius: 8px;
                    text-align: center;
                    margin: 20px 0;
                    font-family: monospace;
                    font-size: 16px;
                    font-weight: bold;
                    color: #1f2937;
                }
                .footer {
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #e5e7eb;
                    text-align: center;
                    font-size: 14px;
                    color: #6b7280;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="success-icon">✅</div>
                    <div class="logo">🚛 VIITS</div>
                    <h1>Solicitud Procesada</h1>
                </div>

                <p>Hola <strong>${userName}</strong>,</p>

                <p>Tu solicitud de descarga de datos ha sido procesada exitosamente.</p>

                <div class="request-id">
                    ID de Solicitud: ${requestId}
                </div>

                <p>Recibirás una notificación cuando tus datos estén listos para descargar.</p>

                <p>Puedes hacer seguimiento de tu solicitud desde tu panel de usuario.</p>

                <div class="footer">
                    <p><strong>VIITS - Sistema de Vigilancia Inteligente</strong></p>
                    <p>Instituto Nacional de Vías (INVIAS) - Colombia</p>
                </div>
            </div>
        </body>
        </html>
    `;

    return await sendEmail(to, subject, html);
};

module.exports = {
    sendEmail,
    sendVerificationCode,
    sendPasswordResetToken,
    sendDownloadConfirmation
};
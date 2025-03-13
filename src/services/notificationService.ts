import nodemailer from 'nodemailer';
import { config } from '../config';
import logger from '../utils/logger';
import { MentionData, NotificationContent } from '../types';

// Initialize email transporter
const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: {
        user: config.email.user,
        pass: config.email.pass,
    },
});

export const sendEmailNotification = async (
    mentionData: MentionData
): Promise<boolean> => {
    try {
        const notification = formatEmailNotification(mentionData);

        // Create a more detailed HTML content with post details
        const htmlContent = `
      <h2>${notification.title}</h2>
      <p>${notification.body.replace(/\n/g, '<br>')}</p>
      
      <h3>Post Details:</h3>
      <ul>
        <li><strong>Platform:</strong> ${mentionData.platform}</li>
        <li><strong>Time:</strong> ${new Date(mentionData.timestamp).toLocaleString()}</li>
        ${mentionData.postContent ? `<li><strong>Post Content:</strong> "${mentionData.postContent}"</li>` : ''}
        <li><strong>Comment:</strong> "${mentionData.commentText}"</li>
      </ul>
      
      <h3>User Information:</h3>
      <ul>
        <li><strong>User ID:</strong> ${mentionData.taggerId}</li>
        ${mentionData.taggerName ? `<li><strong>Name:</strong> ${mentionData.taggerName}</li>` : ''}
        ${mentionData.taggerUsername ? `<li><strong>Username:</strong> @${mentionData.taggerUsername}</li>` : ''}
        ${mentionData.taggerProfilePicUrl ? `<li><strong>Profile Picture:</strong> <a href="${mentionData.taggerProfilePicUrl}" target="_blank">View</a></li>` : ''}
      </ul>
      
      ${notification.url ? `<p><a href="${notification.url}">View the post</a></p>` : ''}
    `;

        await transporter.sendMail({
            from: config.email.from,
            to: config.email.to,
            subject: notification.title,
            html: htmlContent,
        });

        logger.info(`Email notification sent for ${mentionData.platform} mention`);
        return true;
    } catch (error) {
        logger.error(`Error sending email notification: ${error}`);
        return false;
    }
};

const formatEmailNotification = (mentionData: MentionData): NotificationContent => {
    const taggerName = mentionData.taggerName || mentionData.taggerUsername || 'Someone';
    const platformName = mentionData.platform.charAt(0).toUpperCase() + mentionData.platform.slice(1);
    const mentionedUsername = mentionData.mentionedUsername || 'your business';

    return {
        title: `New ${platformName} Mention Alert!`,
        body: `${taggerName} mentioned @${mentionedUsername} in a comment:\n\n"${mentionData.commentText}"`,
        url: mentionData.postUrl,
    };
};

export const sendAllNotifications = async (mentionData: MentionData): Promise<void> => {
    try {
        await sendEmailNotification(mentionData);
        logger.info(`Email notification sent for ${mentionData.platform} mention`);
    } catch (error) {
        logger.error(`Error sending notifications: ${error}`);
    }
};
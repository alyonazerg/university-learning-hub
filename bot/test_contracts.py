import unittest
from bot.contracts import StudentBinding, TaskAudience, InvalidSubmission, homework_envelope, notification_payload


class TelegramContractsTest(unittest.TestCase):
    def setUp(self):
        self.student = StudentBinding('fictional-public-id', 123456, 1, True)
        self.task = TaskAudience('fictional-task-id', frozenset({1, 3}))
        self.message = {'chat': {'id': 123456, 'type': 'private'}, 'from': {'id': 123456}, 'message_id': 10, 'text': 'Fictional work.'}

    def test_private_task_membership_and_sender_are_checked(self):
        self.assertEqual(homework_envelope(self.message, self.student, self.task)['text'], 'Fictional work.')
        with self.assertRaises(InvalidSubmission):
            homework_envelope(self.message, self.student, TaskAudience('other', frozenset({2})))
        self.message['from']['id'] = 654321
        with self.assertRaises(InvalidSubmission):
            homework_envelope(self.message, self.student, self.task)
        self.message['from']['id'] = 123456
        self.message['chat']['type'] = 'group'
        with self.assertRaises(InvalidSubmission):
            homework_envelope(self.message, self.student, self.task)

    def test_photo_variants_form_one_private_reference_and_idempotency_key(self):
        self.message.pop('text')
        self.message['photo'] = [{'file_id': 'small', 'width': 10, 'height': 10}, {'file_id': 'large', 'width': 100, 'height': 100}]
        envelope = homework_envelope(self.message, self.student, self.task)
        self.assertEqual(envelope['private_media'], [{'telegram_file_id': 'large'}])
        self.assertEqual(envelope['source_key'], homework_envelope(self.message, self.student, self.task)['source_key'])
        self.assertNotIn('chat_id', envelope)
        self.message['photo'][1]['file_size'] = 6 * 1024 * 1024
        with self.assertRaises(InvalidSubmission):
            homework_envelope(self.message, self.student, self.task)

    def test_notifications_require_subscription_and_target_group(self):
        url = 'https://mooncampus.ru/learning'
        self.assertIsNone(notification_payload(self.student, frozenset({2}), url))
        self.assertIsNone(notification_payload(StudentBinding('id', 123456, 1), frozenset({1}), url))
        payload = notification_payload(self.student, frozenset({1}), url)
        self.assertNotIn('123456', payload['text'])
        self.assertNotIn('fictional-public-id', payload['text'])
        with self.assertRaises(ValueError):
            notification_payload(self.student, frozenset({1}), 'http://example.com')


if __name__ == '__main__':
    unittest.main()

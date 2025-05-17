from django.apps import AppConfig


class IncodefyConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'incodefy'

    def ready(self):
        import incodefy.signals

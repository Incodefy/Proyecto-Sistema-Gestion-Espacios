from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Agenda
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


@receiver([post_save, post_delete], sender=Agenda)
def notificar_cambio_agenda(sender, instance, **kwargs):
    print("🚀 Enviando mensaje al WebSocket...")
    channel_layer = get_channel_layer()
    data = {
        'box_id': instance.idbox.idbox,
        'trigger': 'cambio_en_agenda'
    }
    print(f"🚀 Enviando mensaje al WebSocket... {data}")
    async_to_sync(channel_layer.group_send)(
        'estado_boxes',
        {
            'type': 'enviar_actualizacion',
            'message': data
        }
    )
    print("✅ Mensaje enviado al WebSocket.")

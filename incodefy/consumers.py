import json
from channels.generic.websocket import WebsocketConsumer
from asgiref.sync import async_to_sync

class EstadoBoxConsumer(WebsocketConsumer):
    def connect(self):
        self.accept()
        print("Conexión WebSocket aceptada")
        
        async_to_sync(self.channel_layer.group_add)(
            "estado_boxes",
            self.channel_name
        )
        print("Canal añadido al grupo 'estado_boxes'")
    
    def disconnect(self, close_code):
        print(f"Desconectado de WebSocket con código: {close_code}")
        try:
            async_to_sync(self.channel_layer.group_discard)(
                "estado_boxes",
                self.channel_name
            )
            print("Canal removido del grupo 'estado_boxes'")
        except AttributeError:
            print("No se pudo remover del grupo: la conexión no estaba completamente establecida")
    
    def receive(self, text_data):
        print(f"Mensaje recibido del cliente: {text_data}")

from django.urls import path
from . import views

urlpatterns = [
    path('agenda/', views.agenda, name='agenda'),
    path('agenda/calendario/<str:tipo>/', views.calendario_agenda, name='calendario_agenda'),
    path('obtener-agendamientos/', views.obtener_agendamientos, name='obtener_agendamientos'),
    path('box/', views.box, name='box'),
    path('box/box<int:boxid>/', views.box_detail, name='box_detail'),
    path('obtener-info-box/', views.obtener_info_box, name='obtener_info_box'),
    path("estado_boxes/", views.estado_boxes, name="estado_boxes"),
]

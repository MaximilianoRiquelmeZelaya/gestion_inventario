from django.urls import path
from . import views

urlpatterns = [
    # Autenticación
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    
    # Vistas Principales (Barra Superior)
    path('', views.inventario_view, name='inventario'),
    path('solicitudes/', views.solicitudes_view, name='solicitudes'),
    path('gestion-bd/', views.gestion_bd_view, name='gestion_bd'),
    path('usuarios/', views.usuarios_view, name='usuarios'),
    path('configuracion/', views.configuracion_view, name='configuracion'),
    path('registros/', views.registros_view, name='registros'),
    path('historial/', views.historial_view, name='historial'),
    
    # APIs y Utilidades
    path('api/insumos/', views.get_insumos_bodega, name='api_insumos'),
    path('api/guardar-orden-form/', views.guardar_orden_form, name='guardar_orden_form'),
    path('exportar/<str:db_name>/<str:coll_name>/', views.exportar_excel, name='exportar_excel'),
]
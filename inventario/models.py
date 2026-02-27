from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone

class Usuario(AbstractUser):
    ROLE_CHOICES = (('superuser', 'Super Usuario'), ('admin', 'Administrador'), ('user', 'Usuario Normal'))
    rol = models.CharField(max_length=15, choices=ROLE_CHOICES, default='user')
    permisos_colecciones = models.JSONField(default=list, blank=True)
    
    tema = models.CharField(max_length=20, default='system')
    pagina_inicio = models.CharField(max_length=50, default='inventario')
    db_preferida = models.CharField(max_length=100, blank=True, null=True)
    bodega_preferida = models.CharField(max_length=100, blank=True, null=True)
    orden_formularios = models.JSONField(default=dict, blank=True)

    def puede_editar(self, coleccion):
        if self.rol in ['admin', 'superuser']:
            return True
        return coleccion in self.permisos_colecciones

class PlantillaBaseDatos(models.Model):
    nombre_db = models.CharField(max_length=100, unique=True)
    campos = models.JSONField(default=list) 

    def __str__(self):
        return self.nombre_db

class Solicitud(models.Model):
    ESTADO_CHOICES = (
        ('Pendiente', '🟡 Pendiente'), ('Aprobada', '🟢 Aprobada'),
        ('Rechazada', '🔴 Rechazada'), ('Modificada', '🟠 Modificada'),
        ('Recepcionada', '✅ Recepcionada'), 
        ('Cancelada', '⚫ Cancelada'), 
    )
    solicitante = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='solicitudes')
    insumo = models.CharField(max_length=200)
    
    db_origen = models.CharField(max_length=100, default='-')
    bodega_origen = models.CharField(max_length=100)
    
    db_destino = models.CharField(max_length=100, default='-')
    bodega_destino = models.CharField(max_length=100)
    
    cantidad = models.PositiveIntegerField()
    estado = models.CharField(max_length=50, choices=ESTADO_CHOICES, default='Pendiente')
    comentario = models.TextField(blank=True, null=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

class RegistroIntegridad(models.Model):
    fecha_monitoreo = models.DateTimeField(default=timezone.now)
    nombre_monitor = models.CharField(max_length=200)
    ubicacion = models.CharField(max_length=200, blank=True, null=True)
    equipo = models.CharField(max_length=200)
    cantidad = models.IntegerField(default=0)
    estatus = models.CharField(max_length=2, choices=[('C', 'C'), ('NC', 'NC')], blank=True, null=True)
    accion_correctiva = models.TextField(blank=True, null=True)
    observacion = models.TextField(blank=True, null=True)
    verificacion = models.TextField(blank=True, null=True)
    estado_verificacion = models.CharField(max_length=50, default='Pendiente de verificación')
    
    mongo_doc_id = models.CharField(max_length=50)
    db_origen = models.CharField(max_length=100)
    coll_origen = models.CharField(max_length=100)
    campo_cantidad_origen = models.CharField(max_length=100, default='Stock Actual')

    def __str__(self):
        return f"{self.equipo} - {self.fecha_monitoreo.strftime('%d/%m/%Y')} ({self.estatus})"

class HistorialCambio(models.Model):
    TIPO_CHOICES = (
        ('modificación', 'Modificación'),
        ('eliminación', 'Eliminación'),
        ('solicitud', 'Solicitud'),
        ('registros', 'Registros'),
        ('control', 'Control'),
        ('creación', 'Creación'),
        ('importación', 'Importación')
    )
    tipo_cambio = models.CharField(max_length=50, choices=TIPO_CHOICES)
    detalle_cambio = models.TextField()
    usuario = models.CharField(max_length=150)
    fecha = models.DateField(auto_now_add=True)
    hora = models.TimeField(auto_now_add=True)
    base = models.CharField(max_length=100, default='-')
    coleccion = models.CharField(max_length=100, default='-')
    datos_extra = models.JSONField(blank=True, null=True)

    class Meta:
        ordering = ['-fecha', '-hora']
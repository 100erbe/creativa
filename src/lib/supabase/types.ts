export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      acabados: {
        Row: {
          codigo: string
          id: number
          nombre: string
          notas: string | null
          precio: number
          unidad_recargo: Database["public"]["Enums"]["unidad_venta"]
        }
        Insert: {
          codigo: string
          id?: number
          nombre: string
          notas?: string | null
          precio?: number
          unidad_recargo: Database["public"]["Enums"]["unidad_venta"]
        }
        Update: {
          codigo?: string
          id?: number
          nombre?: string
          notas?: string | null
          precio?: number
          unidad_recargo?: Database["public"]["Enums"]["unidad_venta"]
        }
        Relationships: []
      }
      asignaciones_punto: {
        Row: {
          creado_en: string
          estado: Database["public"]["Enums"]["estado_asignacion"]
          fecha_completada: string | null
          fecha_programada: string | null
          id: number
          notas: string | null
          punto_id: number
          rol_asignacion: Database["public"]["Enums"]["rol_asignacion"]
          usuario_id: string
        }
        Insert: {
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_asignacion"]
          fecha_completada?: string | null
          fecha_programada?: string | null
          id?: number
          notas?: string | null
          punto_id: number
          rol_asignacion?: Database["public"]["Enums"]["rol_asignacion"]
          usuario_id: string
        }
        Update: {
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_asignacion"]
          fecha_completada?: string | null
          fecha_programada?: string | null
          id?: number
          notas?: string | null
          punto_id?: number
          rol_asignacion?: Database["public"]["Enums"]["rol_asignacion"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asignaciones_punto_punto_id_fkey"
            columns: ["punto_id"]
            isOneToOne: false
            referencedRelation: "puntos_campana"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asignaciones_punto_punto_id_fkey"
            columns: ["punto_id"]
            isOneToOne: false
            referencedRelation: "v_agenda_empleado"
            referencedColumns: ["punto_id"]
          },
          {
            foreignKeyName: "asignaciones_punto_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asignaciones_punto_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "v_agenda_empleado"
            referencedColumns: ["usuario_id"]
          },
        ]
      }
      campanas: {
        Row: {
          actualizado_en: string
          cliente_id: number
          codigo: string | null
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          documento_id: number | null
          estado: Database["public"]["Enums"]["estado_campana"]
          fecha_fin: string | null
          fecha_inicio: string | null
          id: number
          nombre: string
        }
        Insert: {
          actualizado_en?: string
          cliente_id: number
          codigo?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          documento_id?: number | null
          estado?: Database["public"]["Enums"]["estado_campana"]
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: number
          nombre: string
        }
        Update: {
          actualizado_en?: string
          cliente_id?: number
          codigo?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          documento_id?: number | null
          estado?: Database["public"]["Enums"]["estado_campana"]
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: number
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "campanas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanas_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanas_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "v_agenda_empleado"
            referencedColumns: ["usuario_id"]
          },
          {
            foreignKeyName: "campanas_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanas_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "v_estado_cobro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanas_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "v_pendiente_facturar"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          codigo: string
          id: number
          nombre: string
          orden: number
        }
        Insert: {
          codigo: string
          id?: number
          nombre: string
          orden?: number
        }
        Update: {
          codigo?: string
          id?: number
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      clientes: {
        Row: {
          activo: boolean
          actualizado_en: string
          codigo: string
          codigo_postal: string | null
          creado_en: string
          cuenta_cobro_id: number | null
          descuento_habitual: number
          direccion: string | null
          email_facturacion: string | null
          forma_pago_id: number | null
          grupo_id: number | null
          id: number
          motivo_exencion: string | null
          municipio: string | null
          nombre_comercial: string | null
          notas: string | null
          numero_documento: string | null
          pais: string
          provincia: string | null
          razon_social: string
          regimen_iva: Database["public"]["Enums"]["regimen_iva"]
          telefono: string | null
          tipo_cliente: Database["public"]["Enums"]["tipo_cliente"]
          tipo_documento: Database["public"]["Enums"]["tipo_documento_id"]
          tipo_persona: Database["public"]["Enums"]["tipo_persona"]
          web: string | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          codigo: string
          codigo_postal?: string | null
          creado_en?: string
          cuenta_cobro_id?: number | null
          descuento_habitual?: number
          direccion?: string | null
          email_facturacion?: string | null
          forma_pago_id?: number | null
          grupo_id?: number | null
          id?: number
          motivo_exencion?: string | null
          municipio?: string | null
          nombre_comercial?: string | null
          notas?: string | null
          numero_documento?: string | null
          pais?: string
          provincia?: string | null
          razon_social: string
          regimen_iva?: Database["public"]["Enums"]["regimen_iva"]
          telefono?: string | null
          tipo_cliente?: Database["public"]["Enums"]["tipo_cliente"]
          tipo_documento?: Database["public"]["Enums"]["tipo_documento_id"]
          tipo_persona?: Database["public"]["Enums"]["tipo_persona"]
          web?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          codigo?: string
          codigo_postal?: string | null
          creado_en?: string
          cuenta_cobro_id?: number | null
          descuento_habitual?: number
          direccion?: string | null
          email_facturacion?: string | null
          forma_pago_id?: number | null
          grupo_id?: number | null
          id?: number
          motivo_exencion?: string | null
          municipio?: string | null
          nombre_comercial?: string | null
          notas?: string | null
          numero_documento?: string | null
          pais?: string
          provincia?: string | null
          razon_social?: string
          regimen_iva?: Database["public"]["Enums"]["regimen_iva"]
          telefono?: string | null
          tipo_cliente?: Database["public"]["Enums"]["tipo_cliente"]
          tipo_documento?: Database["public"]["Enums"]["tipo_documento_id"]
          tipo_persona?: Database["public"]["Enums"]["tipo_persona"]
          web?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_cuenta_cobro_id_fkey"
            columns: ["cuenta_cobro_id"]
            isOneToOne: false
            referencedRelation: "cuentas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_forma_pago_id_fkey"
            columns: ["forma_pago_id"]
            isOneToOne: false
            referencedRelation: "formas_pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos_empresariales"
            referencedColumns: ["id"]
          },
        ]
      }
      cobros: {
        Row: {
          creado_en: string
          cuenta_bancaria_id: number | null
          documento_id: number
          fecha: string
          id: number
          importe: number
          metodo: Database["public"]["Enums"]["metodo_cobro"]
          notas: string | null
          recibo_id: number | null
          referencia: string | null
        }
        Insert: {
          creado_en?: string
          cuenta_bancaria_id?: number | null
          documento_id: number
          fecha?: string
          id?: number
          importe: number
          metodo?: Database["public"]["Enums"]["metodo_cobro"]
          notas?: string | null
          recibo_id?: number | null
          referencia?: string | null
        }
        Update: {
          creado_en?: string
          cuenta_bancaria_id?: number | null
          documento_id?: number
          fecha?: string
          id?: number
          importe?: number
          metodo?: Database["public"]["Enums"]["metodo_cobro"]
          notas?: string | null
          recibo_id?: number | null
          referencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobros_cuenta_bancaria_id_fkey"
            columns: ["cuenta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "cuentas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobros_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobros_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "v_estado_cobro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobros_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "v_pendiente_facturar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobros_recibo_id_fkey"
            columns: ["recibo_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobros_recibo_id_fkey"
            columns: ["recibo_id"]
            isOneToOne: false
            referencedRelation: "v_estado_cobro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobros_recibo_id_fkey"
            columns: ["recibo_id"]
            isOneToOne: false
            referencedRelation: "v_pendiente_facturar"
            referencedColumns: ["id"]
          },
        ]
      }
      contactos_cliente: {
        Row: {
          cargo: string | null
          cliente_id: number
          email: string | null
          id: number
          nombre: string
          notas: string | null
          recibe_enlace_campana: boolean
          recibe_facturas: boolean
          telefono: string | null
        }
        Insert: {
          cargo?: string | null
          cliente_id: number
          email?: string | null
          id?: number
          nombre: string
          notas?: string | null
          recibe_enlace_campana?: boolean
          recibe_facturas?: boolean
          telefono?: string | null
        }
        Update: {
          cargo?: string | null
          cliente_id?: number
          email?: string | null
          id?: number
          nombre?: string
          notas?: string | null
          recibe_enlace_campana?: boolean
          recibe_facturas?: boolean
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contactos_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      contadores_serie: {
        Row: {
          anio: number
          serie_id: number
          ultimo: number
        }
        Insert: {
          anio: number
          serie_id: number
          ultimo?: number
        }
        Update: {
          anio?: number
          serie_id?: number
          ultimo?: number
        }
        Relationships: [
          {
            foreignKeyName: "contadores_serie_serie_id_fkey"
            columns: ["serie_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      cuentas_bancarias: {
        Row: {
          activa: boolean
          banco: string
          iban: string
          id: number
          por_defecto: boolean
        }
        Insert: {
          activa?: boolean
          banco: string
          iban: string
          id?: number
          por_defecto?: boolean
        }
        Update: {
          activa?: boolean
          banco?: string
          iban?: string
          id?: number
          por_defecto?: boolean
        }
        Relationships: []
      }
      documentos: {
        Row: {
          actualizado_en: string
          anio: number | null
          base_imponible: number
          campana: string | null
          campana_id: number | null
          cliente_cp: string | null
          cliente_direccion: string | null
          cliente_documento: string | null
          cliente_id: number
          cliente_municipio: string | null
          cliente_pais: string | null
          cliente_provincia: string | null
          cliente_razon_social: string | null
          creado_en: string
          creado_por: string | null
          cuenta_cobro_id: number | null
          cuota_iva: number
          descripcion: string | null
          descuento_global_pct: number
          documento_origen_id: number | null
          enviado_a: string | null
          enviado_en: string | null
          estado: Database["public"]["Enums"]["estado_documento"]
          fecha: string
          fecha_operacion: string | null
          fecha_vencimiento: string | null
          firmado: boolean
          forma_pago_id: number | null
          iban_cobro: string | null
          id: number
          importe_descuento: number
          importe_retencion: number
          motivo_exencion: string | null
          motivo_rectificacion: string | null
          notas_cliente: string | null
          notas_internas: string | null
          numero: number | null
          numero_completo: string | null
          pdf_url: string | null
          regimen_iva: Database["public"]["Enums"]["regimen_iva"]
          retencion_pct: number
          serie_id: number
          suma_lineas: number
          texto_forma_pago: string | null
          tipo: Database["public"]["Enums"]["tipo_documento"]
          total: number
          valido_hasta: string | null
          verifactu_estado: string | null
          verifactu_huella: string | null
          verifactu_huella_anterior: string | null
          verifactu_qr: string | null
        }
        Insert: {
          actualizado_en?: string
          anio?: number | null
          base_imponible?: number
          campana?: string | null
          campana_id?: number | null
          cliente_cp?: string | null
          cliente_direccion?: string | null
          cliente_documento?: string | null
          cliente_id: number
          cliente_municipio?: string | null
          cliente_pais?: string | null
          cliente_provincia?: string | null
          cliente_razon_social?: string | null
          creado_en?: string
          creado_por?: string | null
          cuenta_cobro_id?: number | null
          cuota_iva?: number
          descripcion?: string | null
          descuento_global_pct?: number
          documento_origen_id?: number | null
          enviado_a?: string | null
          enviado_en?: string | null
          estado?: Database["public"]["Enums"]["estado_documento"]
          fecha?: string
          fecha_operacion?: string | null
          fecha_vencimiento?: string | null
          firmado?: boolean
          forma_pago_id?: number | null
          iban_cobro?: string | null
          id?: number
          importe_descuento?: number
          importe_retencion?: number
          motivo_exencion?: string | null
          motivo_rectificacion?: string | null
          notas_cliente?: string | null
          notas_internas?: string | null
          numero?: number | null
          numero_completo?: string | null
          pdf_url?: string | null
          regimen_iva?: Database["public"]["Enums"]["regimen_iva"]
          retencion_pct?: number
          serie_id: number
          suma_lineas?: number
          texto_forma_pago?: string | null
          tipo: Database["public"]["Enums"]["tipo_documento"]
          total?: number
          valido_hasta?: string | null
          verifactu_estado?: string | null
          verifactu_huella?: string | null
          verifactu_huella_anterior?: string | null
          verifactu_qr?: string | null
        }
        Update: {
          actualizado_en?: string
          anio?: number | null
          base_imponible?: number
          campana?: string | null
          campana_id?: number | null
          cliente_cp?: string | null
          cliente_direccion?: string | null
          cliente_documento?: string | null
          cliente_id?: number
          cliente_municipio?: string | null
          cliente_pais?: string | null
          cliente_provincia?: string | null
          cliente_razon_social?: string | null
          creado_en?: string
          creado_por?: string | null
          cuenta_cobro_id?: number | null
          cuota_iva?: number
          descripcion?: string | null
          descuento_global_pct?: number
          documento_origen_id?: number | null
          enviado_a?: string | null
          enviado_en?: string | null
          estado?: Database["public"]["Enums"]["estado_documento"]
          fecha?: string
          fecha_operacion?: string | null
          fecha_vencimiento?: string | null
          firmado?: boolean
          forma_pago_id?: number | null
          iban_cobro?: string | null
          id?: number
          importe_descuento?: number
          importe_retencion?: number
          motivo_exencion?: string | null
          motivo_rectificacion?: string | null
          notas_cliente?: string | null
          notas_internas?: string | null
          numero?: number | null
          numero_completo?: string | null
          pdf_url?: string | null
          regimen_iva?: Database["public"]["Enums"]["regimen_iva"]
          retencion_pct?: number
          serie_id?: number
          suma_lineas?: number
          texto_forma_pago?: string | null
          tipo?: Database["public"]["Enums"]["tipo_documento"]
          total?: number
          valido_hasta?: string | null
          verifactu_estado?: string | null
          verifactu_huella?: string | null
          verifactu_huella_anterior?: string | null
          verifactu_qr?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_campana_fk"
            columns: ["campana_id"]
            isOneToOne: false
            referencedRelation: "campanas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_campana_fk"
            columns: ["campana_id"]
            isOneToOne: false
            referencedRelation: "v_agenda_empleado"
            referencedColumns: ["campana_id"]
          },
          {
            foreignKeyName: "documentos_campana_fk"
            columns: ["campana_id"]
            isOneToOne: false
            referencedRelation: "v_progreso_campana"
            referencedColumns: ["campana_id"]
          },
          {
            foreignKeyName: "documentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_cuenta_cobro_id_fkey"
            columns: ["cuenta_cobro_id"]
            isOneToOne: false
            referencedRelation: "cuentas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_documento_origen_id_fkey"
            columns: ["documento_origen_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_documento_origen_id_fkey"
            columns: ["documento_origen_id"]
            isOneToOne: false
            referencedRelation: "v_estado_cobro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_documento_origen_id_fkey"
            columns: ["documento_origen_id"]
            isOneToOne: false
            referencedRelation: "v_pendiente_facturar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_forma_pago_id_fkey"
            columns: ["forma_pago_id"]
            isOneToOne: false
            referencedRelation: "formas_pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_serie_id_fkey"
            columns: ["serie_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa: {
        Row: {
          codigo_postal: string | null
          direccion: string
          email: string | null
          id: number
          lema: string | null
          logo_url: string | null
          movil: string | null
          municipio: string | null
          nif: string
          nombre_comercial: string
          provincia: string | null
          razon_social: string
          telefono: string | null
          validez_presupuesto_dias: number
        }
        Insert: {
          codigo_postal?: string | null
          direccion: string
          email?: string | null
          id?: number
          lema?: string | null
          logo_url?: string | null
          movil?: string | null
          municipio?: string | null
          nif: string
          nombre_comercial: string
          provincia?: string | null
          razon_social: string
          telefono?: string | null
          validez_presupuesto_dias?: number
        }
        Update: {
          codigo_postal?: string | null
          direccion?: string
          email?: string | null
          id?: number
          lema?: string | null
          logo_url?: string | null
          movil?: string | null
          municipio?: string | null
          nif?: string
          nombre_comercial?: string
          provincia?: string | null
          razon_social?: string
          telefono?: string | null
          validez_presupuesto_dias?: number
        }
        Relationships: []
      }
      enlaces_cliente: {
        Row: {
          activo: boolean
          campana_id: number
          creado_en: string
          creado_por: string | null
          expira_en: string | null
          id: number
          token: string
          ultima_vista_en: string | null
          vistas: number
        }
        Insert: {
          activo?: boolean
          campana_id: number
          creado_en?: string
          creado_por?: string | null
          expira_en?: string | null
          id?: number
          token?: string
          ultima_vista_en?: string | null
          vistas?: number
        }
        Update: {
          activo?: boolean
          campana_id?: number
          creado_en?: string
          creado_por?: string | null
          expira_en?: string | null
          id?: number
          token?: string
          ultima_vista_en?: string | null
          vistas?: number
        }
        Relationships: [
          {
            foreignKeyName: "enlaces_cliente_campana_id_fkey"
            columns: ["campana_id"]
            isOneToOne: false
            referencedRelation: "campanas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enlaces_cliente_campana_id_fkey"
            columns: ["campana_id"]
            isOneToOne: false
            referencedRelation: "v_agenda_empleado"
            referencedColumns: ["campana_id"]
          },
          {
            foreignKeyName: "enlaces_cliente_campana_id_fkey"
            columns: ["campana_id"]
            isOneToOne: false
            referencedRelation: "v_progreso_campana"
            referencedColumns: ["campana_id"]
          },
          {
            foreignKeyName: "enlaces_cliente_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enlaces_cliente_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "v_agenda_empleado"
            referencedColumns: ["usuario_id"]
          },
        ]
      }
      formas_pago: {
        Row: {
          dias_vencimiento: number
          id: number
          nombre: string
          texto_factura: string | null
        }
        Insert: {
          dias_vencimiento?: number
          id?: number
          nombre: string
          texto_factura?: string | null
        }
        Update: {
          dias_vencimiento?: number
          id?: number
          nombre?: string
          texto_factura?: string | null
        }
        Relationships: []
      }
      formatos: {
        Row: {
          activo: boolean
          alias: string[] | null
          alto_cm: number | null
          ancho_cm: number | null
          codigo: string
          id: number
          nombre: string
          precio_fabricacion: number | null
          precio_instalacion: number | null
          producto_id: number
          superficie_m2: number | null
        }
        Insert: {
          activo?: boolean
          alias?: string[] | null
          alto_cm?: number | null
          ancho_cm?: number | null
          codigo: string
          id?: number
          nombre: string
          precio_fabricacion?: number | null
          precio_instalacion?: number | null
          producto_id: number
          superficie_m2?: number | null
        }
        Update: {
          activo?: boolean
          alias?: string[] | null
          alto_cm?: number | null
          ancho_cm?: number | null
          codigo?: string
          id?: number
          nombre?: string
          precio_fabricacion?: number | null
          precio_instalacion?: number | null
          producto_id?: number
          superficie_m2?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "formatos_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      fotos_punto: {
        Row: {
          asignacion_id: number | null
          id: number
          latitud: number | null
          longitud: number | null
          notas: string | null
          origen_foto: string
          origen_ubicacion: string | null
          punto_id: number
          tipo: Database["public"]["Enums"]["tipo_foto"]
          tomada_en: string
          url_foto: string
          usuario_id: string
        }
        Insert: {
          asignacion_id?: number | null
          id?: number
          latitud?: number | null
          longitud?: number | null
          notas?: string | null
          origen_foto?: string
          origen_ubicacion?: string | null
          punto_id: number
          tipo?: Database["public"]["Enums"]["tipo_foto"]
          tomada_en?: string
          url_foto: string
          usuario_id: string
        }
        Update: {
          asignacion_id?: number | null
          id?: number
          latitud?: number | null
          longitud?: number | null
          notas?: string | null
          origen_foto?: string
          origen_ubicacion?: string | null
          punto_id?: number
          tipo?: Database["public"]["Enums"]["tipo_foto"]
          tomada_en?: string
          url_foto?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fotos_punto_asignacion_id_fkey"
            columns: ["asignacion_id"]
            isOneToOne: false
            referencedRelation: "asignaciones_punto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fotos_punto_asignacion_id_fkey"
            columns: ["asignacion_id"]
            isOneToOne: false
            referencedRelation: "v_agenda_empleado"
            referencedColumns: ["asignacion_id"]
          },
          {
            foreignKeyName: "fotos_punto_punto_id_fkey"
            columns: ["punto_id"]
            isOneToOne: false
            referencedRelation: "puntos_campana"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fotos_punto_punto_id_fkey"
            columns: ["punto_id"]
            isOneToOne: false
            referencedRelation: "v_agenda_empleado"
            referencedColumns: ["punto_id"]
          },
          {
            foreignKeyName: "fotos_punto_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fotos_punto_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "v_agenda_empleado"
            referencedColumns: ["usuario_id"]
          },
        ]
      }
      grupos_empresariales: {
        Row: {
          id: number
          nombre: string
          notas: string | null
        }
        Insert: {
          id?: number
          nombre: string
          notas?: string | null
        }
        Update: {
          id?: number
          nombre?: string
          notas?: string | null
        }
        Relationships: []
      }
      lineas_documento: {
        Row: {
          acabados: number[] | null
          alcance: Database["public"]["Enums"]["alcance_servicio"]
          alto_cm: number | null
          ancho_cm: number | null
          articulo: string | null
          artista: string | null
          cantidad: number
          descripcion: string
          descuento_pct: number
          documento_id: number
          formato_id: number | null
          id: number
          importe: number
          iva_pct: number
          minimo_por_pieza: number | null
          orden: number
          piezas: number
          precio_fabricacion: number | null
          precio_instalacion: number | null
          precio_unitario: number
          producto_id: number | null
          recargo_acabados: number
          unidad: Database["public"]["Enums"]["unidad_venta"]
        }
        Insert: {
          acabados?: number[] | null
          alcance?: Database["public"]["Enums"]["alcance_servicio"]
          alto_cm?: number | null
          ancho_cm?: number | null
          articulo?: string | null
          artista?: string | null
          cantidad?: number
          descripcion: string
          descuento_pct?: number
          documento_id: number
          formato_id?: number | null
          id?: number
          importe?: number
          iva_pct?: number
          minimo_por_pieza?: number | null
          orden?: number
          piezas?: number
          precio_fabricacion?: number | null
          precio_instalacion?: number | null
          precio_unitario: number
          producto_id?: number | null
          recargo_acabados?: number
          unidad?: Database["public"]["Enums"]["unidad_venta"]
        }
        Update: {
          acabados?: number[] | null
          alcance?: Database["public"]["Enums"]["alcance_servicio"]
          alto_cm?: number | null
          ancho_cm?: number | null
          articulo?: string | null
          artista?: string | null
          cantidad?: number
          descripcion?: string
          descuento_pct?: number
          documento_id?: number
          formato_id?: number | null
          id?: number
          importe?: number
          iva_pct?: number
          minimo_por_pieza?: number | null
          orden?: number
          piezas?: number
          precio_fabricacion?: number | null
          precio_instalacion?: number | null
          precio_unitario?: number
          producto_id?: number | null
          recargo_acabados?: number
          unidad?: Database["public"]["Enums"]["unidad_venta"]
        }
        Relationships: [
          {
            foreignKeyName: "lineas_documento_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineas_documento_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "v_estado_cobro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineas_documento_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "v_pendiente_facturar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineas_documento_formato_id_fkey"
            columns: ["formato_id"]
            isOneToOne: false
            referencedRelation: "formatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineas_documento_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      plantillas_linea: {
        Row: {
          acabados: number[] | null
          activo: boolean
          alcance: Database["public"]["Enums"]["alcance_servicio"]
          creado_en: string
          formato_id: number | null
          id: number
          nombre: string
          orden_visual: number
          piezas_sugeridas: number
          producto_id: number
          unidad: Database["public"]["Enums"]["unidad_venta"]
        }
        Insert: {
          acabados?: number[] | null
          activo?: boolean
          alcance?: Database["public"]["Enums"]["alcance_servicio"]
          creado_en?: string
          formato_id?: number | null
          id?: number
          nombre: string
          orden_visual?: number
          piezas_sugeridas?: number
          producto_id: number
          unidad?: Database["public"]["Enums"]["unidad_venta"]
        }
        Update: {
          acabados?: number[] | null
          activo?: boolean
          alcance?: Database["public"]["Enums"]["alcance_servicio"]
          creado_en?: string
          formato_id?: number | null
          id?: number
          nombre?: string
          orden_visual?: number
          piezas_sugeridas?: number
          producto_id?: number
          unidad?: Database["public"]["Enums"]["unidad_venta"]
        }
        Relationships: [
          {
            foreignKeyName: "plantillas_linea_formato_id_fkey"
            columns: ["formato_id"]
            isOneToOne: false
            referencedRelation: "formatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantillas_linea_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      producto_acabados: {
        Row: {
          acabado_id: number
          incluido: boolean
          producto_id: number
        }
        Insert: {
          acabado_id: number
          incluido?: boolean
          producto_id: number
        }
        Update: {
          acabado_id?: number
          incluido?: boolean
          producto_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "producto_acabados_acabado_id_fkey"
            columns: ["acabado_id"]
            isOneToOne: false
            referencedRelation: "acabados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_acabados_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      notificaciones: {
        Row: {
          creada_en: string
          cuerpo: string
          id: number
          leida_en: string | null
          tipo: string
          titulo: string
          url: string | null
          usuario_id: string
        }
        Insert: {
          creada_en?: string
          cuerpo: string
          id?: number
          leida_en?: string | null
          tipo: string
          titulo: string
          url?: string | null
          usuario_id: string
        }
        Update: {
          creada_en?: string
          cuerpo?: string
          id?: number
          leida_en?: string | null
          tipo?: string
          titulo?: string
          url?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          activo: boolean
          admite_medida_libre: boolean
          categoria_id: number
          codigo: string
          descripcion_factura: string | null
          id: number
          iva_pct: number
          material: string | null
          nombre: string
          notas: string | null
          pedido_minimo: number | null
          permite_fabricacion: boolean
          permite_instalacion: boolean
          precio_fabricacion: number | null
          precio_instalacion: number | null
          unidad_venta: Database["public"]["Enums"]["unidad_venta"]
        }
        Insert: {
          activo?: boolean
          admite_medida_libre?: boolean
          categoria_id: number
          codigo: string
          descripcion_factura?: string | null
          id?: number
          iva_pct?: number
          material?: string | null
          nombre: string
          notas?: string | null
          pedido_minimo?: number | null
          permite_fabricacion?: boolean
          permite_instalacion?: boolean
          precio_fabricacion?: number | null
          precio_instalacion?: number | null
          unidad_venta: Database["public"]["Enums"]["unidad_venta"]
        }
        Update: {
          activo?: boolean
          admite_medida_libre?: boolean
          categoria_id?: number
          codigo?: string
          descripcion_factura?: string | null
          id?: number
          iva_pct?: number
          material?: string | null
          nombre?: string
          notas?: string | null
          pedido_minimo?: number | null
          permite_fabricacion?: boolean
          permite_instalacion?: boolean
          precio_fabricacion?: number | null
          precio_instalacion?: number | null
          unidad_venta?: Database["public"]["Enums"]["unidad_venta"]
        }
        Relationships: [
          {
            foreignKeyName: "productos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      puntos_campana: {
        Row: {
          actualizado_en: string
          campana_id: number
          creado_en: string
          direccion: string | null
          estado: Database["public"]["Enums"]["estado_punto"]
          fecha_colocacion_prevista: string | null
          fecha_retirada_prevista: string | null
          id: number
          incidencia: string | null
          incidencia_en: string | null
          linea_id: number | null
          piezas: number | null
          latitud: number
          longitud: number
          nombre: string
          notas: string | null
          tipo_soporte: Database["public"]["Enums"]["tipo_soporte"]
        }
        Insert: {
          actualizado_en?: string
          campana_id: number
          creado_en?: string
          direccion?: string | null
          estado?: Database["public"]["Enums"]["estado_punto"]
          fecha_colocacion_prevista?: string | null
          fecha_retirada_prevista?: string | null
          id?: number
          incidencia?: string | null
          incidencia_en?: string | null
          linea_id?: number | null
          piezas?: number | null
          latitud: number
          longitud: number
          nombre: string
          notas?: string | null
          tipo_soporte: Database["public"]["Enums"]["tipo_soporte"]
        }
        Update: {
          actualizado_en?: string
          campana_id?: number
          creado_en?: string
          direccion?: string | null
          estado?: Database["public"]["Enums"]["estado_punto"]
          fecha_colocacion_prevista?: string | null
          fecha_retirada_prevista?: string | null
          id?: number
          incidencia?: string | null
          incidencia_en?: string | null
          linea_id?: number | null
          piezas?: number | null
          latitud?: number
          longitud?: number
          nombre?: string
          notas?: string | null
          tipo_soporte?: Database["public"]["Enums"]["tipo_soporte"]
        }
        Relationships: [
          {
            foreignKeyName: "puntos_campana_campana_id_fkey"
            columns: ["campana_id"]
            isOneToOne: false
            referencedRelation: "campanas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "puntos_campana_campana_id_fkey"
            columns: ["campana_id"]
            isOneToOne: false
            referencedRelation: "v_agenda_empleado"
            referencedColumns: ["campana_id"]
          },
          {
            foreignKeyName: "puntos_campana_campana_id_fkey"
            columns: ["campana_id"]
            isOneToOne: false
            referencedRelation: "v_progreso_campana"
            referencedColumns: ["campana_id"]
          },
        ]
      }
      resumenes_enviados: {
        Row: {
          enviado_en: string
          fecha_objetivo: string
          id: number
          puntos: number
          usuario_id: string
        }
        Insert: {
          enviado_en?: string
          fecha_objetivo: string
          id?: number
          puntos: number
          usuario_id: string
        }
        Update: {
          enviado_en?: string
          fecha_objetivo?: string
          id?: number
          puntos?: number
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resumenes_enviados_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      series: {
        Row: {
          activa: boolean
          codigo: string
          digitos: number
          id: number
          nombre: string
          por_defecto: boolean
          prefijo: string
          sufijo_anual: boolean
          tipo: Database["public"]["Enums"]["tipo_documento"]
        }
        Insert: {
          activa?: boolean
          codigo: string
          digitos?: number
          id?: number
          nombre: string
          por_defecto?: boolean
          prefijo?: string
          sufijo_anual?: boolean
          tipo: Database["public"]["Enums"]["tipo_documento"]
        }
        Update: {
          activa?: boolean
          codigo?: string
          digitos?: number
          id?: number
          nombre?: string
          por_defecto?: boolean
          prefijo?: string
          sufijo_anual?: boolean
          tipo?: Database["public"]["Enums"]["tipo_documento"]
        }
        Relationships: []
      }
      suscripciones_push: {
        Row: {
          actualizada_en: string
          auth: string
          creada_en: string
          endpoint: string
          fallos_seguidos: number
          id: number
          p256dh: string
          ultimo_envio_ok: string | null
          user_agent: string | null
          usuario_id: string
        }
        Insert: {
          actualizada_en?: string
          auth: string
          creada_en?: string
          endpoint: string
          fallos_seguidos?: number
          id?: number
          p256dh: string
          ultimo_envio_ok?: string | null
          user_agent?: string | null
          usuario_id: string
        }
        Update: {
          actualizada_en?: string
          auth?: string
          creada_en?: string
          endpoint?: string
          fallos_seguidos?: number
          id?: number
          p256dh?: string
          ultimo_envio_ok?: string | null
          user_agent?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suscripciones_push_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      tarifas_cliente: {
        Row: {
          cliente_id: number | null
          formato_id: number | null
          id: number
          notas: string | null
          precio_fabricacion: number | null
          precio_instalacion: number | null
          producto_id: number
          tipo_cliente: Database["public"]["Enums"]["tipo_cliente"] | null
          vigente_desde: string
          vigente_hasta: string | null
        }
        Insert: {
          cliente_id?: number | null
          formato_id?: number | null
          id?: number
          notas?: string | null
          precio_fabricacion?: number | null
          precio_instalacion?: number | null
          producto_id: number
          tipo_cliente?: Database["public"]["Enums"]["tipo_cliente"] | null
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Update: {
          cliente_id?: number | null
          formato_id?: number | null
          id?: number
          notas?: string | null
          precio_fabricacion?: number | null
          precio_instalacion?: number | null
          producto_id?: number
          tipo_cliente?: Database["public"]["Enums"]["tipo_cliente"] | null
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tarifas_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarifas_cliente_formato_id_fkey"
            columns: ["formato_id"]
            isOneToOne: false
            referencedRelation: "formatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarifas_cliente_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      tarifas_volumen: {
        Row: {
          cantidad_desde: number
          formato_id: number | null
          id: number
          precio_fabricacion: number | null
          precio_instalacion: number | null
          producto_id: number
        }
        Insert: {
          cantidad_desde: number
          formato_id?: number | null
          id?: number
          precio_fabricacion?: number | null
          precio_instalacion?: number | null
          producto_id: number
        }
        Update: {
          cantidad_desde?: number
          formato_id?: number | null
          id?: number
          precio_fabricacion?: number | null
          precio_instalacion?: number | null
          producto_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "tarifas_volumen_formato_id_fkey"
            columns: ["formato_id"]
            isOneToOne: false
            referencedRelation: "formatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarifas_volumen_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          activo: boolean
          actualizado_en: string
          apellidos: string | null
          avatar_url: string | null
          creado_en: string
          email: string
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["rol_usuario"]
          telefono: string | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          apellidos?: string | null
          avatar_url?: string | null
          creado_en?: string
          email: string
          id: string
          nombre: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          telefono?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          apellidos?: string | null
          avatar_url?: string | null
          creado_en?: string
          email?: string
          id?: string
          nombre?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          telefono?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_agenda_empleado: {
        Row: {
          asignacion_id: number | null
          campana: string | null
          campana_id: number | null
          direccion: string | null
          empleado: string | null
          estado_asignacion:
            | Database["public"]["Enums"]["estado_asignacion"]
            | null
          estado_punto: Database["public"]["Enums"]["estado_punto"] | null
          fecha_programada: string | null
          latitud: number | null
          longitud: number | null
          punto: string | null
          punto_id: number | null
          rol_asignacion: Database["public"]["Enums"]["rol_asignacion"] | null
          tipo_soporte: Database["public"]["Enums"]["tipo_soporte"] | null
          usuario_id: string | null
        }
        Relationships: []
      }
      v_catalogo: {
        Row: {
          admite_medida_libre: boolean | null
          alias: string[] | null
          alto_cm: number | null
          ancho_cm: number | null
          categoria: string | null
          cod_formato: string | null
          cod_producto: string | null
          formato: string | null
          precio_fabricacion: number | null
          precio_instalacion: number | null
          producto: string | null
          superficie_m2: number | null
          unidad_venta: Database["public"]["Enums"]["unidad_venta"] | null
        }
        Relationships: []
      }
      v_estado_cobro: {
        Row: {
          cliente_id: number | null
          cliente_razon_social: string | null
          cobrado: number | null
          estado_cobro: string | null
          fecha: string | null
          fecha_vencimiento: string | null
          id: number | null
          numero_completo: string | null
          pendiente: number | null
          tipo: Database["public"]["Enums"]["tipo_documento"] | null
          total: number | null
          ultimo_cobro: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      v_libro_registro: {
        Row: {
          base_imponible: number | null
          cobrado: number | null
          cuota_iva: number | null
          descripcion: string | null
          destinatario: string | null
          ejercicio: number | null
          estado_cobro: string | null
          factura_rectificada: string | null
          fecha_expedicion: string | null
          fecha_operacion: string | null
          importe_retencion: number | null
          motivo_exencion: string | null
          nif_destinatario: string | null
          numero: string | null
          pendiente: number | null
          periodo: string | null
          regimen_iva: Database["public"]["Enums"]["regimen_iva"] | null
          serie: string | null
          tipo: Database["public"]["Enums"]["tipo_documento"] | null
          total: number | null
        }
        Relationships: []
      }
      v_lineas_recientes_cliente: {
        Row: {
          acabados: number[] | null
          alcance: Database["public"]["Enums"]["alcance_servicio"] | null
          cliente_id: number | null
          formato: string | null
          formato_id: number | null
          producto: string | null
          producto_id: number | null
          ultimo_descuento: number | null
          ultimo_precio: number | null
          unidad: Database["public"]["Enums"]["unidad_venta"] | null
          usado_en: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineas_documento_formato_id_fkey"
            columns: ["formato_id"]
            isOneToOne: false
            referencedRelation: "formatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineas_documento_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      v_pendiente_facturar: {
        Row: {
          base_imponible: number | null
          campana: string | null
          cliente: string | null
          cliente_id: number | null
          estado: Database["public"]["Enums"]["estado_documento"] | null
          fecha: string | null
          id: number | null
          numero_completo: string | null
          tipo: Database["public"]["Enums"]["tipo_documento"] | null
          total: number | null
          valido_hasta: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      v_progreso_campana: {
        Row: {
          campana: string | null
          campana_id: number | null
          cliente: string | null
          estado_campana: Database["public"]["Enums"]["estado_campana"] | null
          fotos_subidas: number | null
          puntos_con_incidencia: number | null
          puntos_instalados: number | null
          puntos_pendientes: number | null
          puntos_totales: number | null
          puntos_verificados: number | null
          puntos_retirados: number | null
        }
        Relationships: []
      }
      v_resumen_iva_trimestral: {
        Row: {
          base_imponible: number | null
          cuota_iva: number | null
          ejercicio: number | null
          iva_pct: number | null
          num_facturas: number | null
          trimestre: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      anadir_linea: {
        Args: {
          p_alcance: Database["public"]["Enums"]["alcance_servicio"]
          p_alto_cm?: number | null
          p_ancho_cm?: number | null
          p_descripcion?: string | null
          p_descuento?: number
          p_artista?: string | null
          p_documento: number
          p_formato: number | null
          p_piezas?: number
          p_precio?: number | null
          p_producto: number
        }
        Returns: number
      }
      previsualizar_precio: {
        Args: {
          p_alcance: Database["public"]["Enums"]["alcance_servicio"]
          p_alto_cm?: number | null
          p_ancho_cm?: number | null
          p_cliente: number
          p_formato: number | null
          p_piezas?: number
          p_producto: number
        }
        Returns: {
          precio: number
          cantidad: number
          unidad: Database["public"]["Enums"]["unidad_venta"]
        }[]
      }
      anadir_linea_rapida: {
        Args: {
          p_acabados?: number[]
          p_alcance: Database["public"]["Enums"]["alcance_servicio"]
          p_alto_cm?: number
          p_ancho_cm?: number
          p_cliente: number
          p_descripcion?: string
          p_documento: number
          p_formato: number
          p_piezas?: number
          p_producto: number
        }
        Returns: number
      }
      cantidad_facturable: {
        Args: {
          p_alto_cm: number
          p_ancho_cm: number
          p_minimo_por_pieza?: number
          p_piezas: number
          p_unidad: Database["public"]["Enums"]["unidad_venta"]
        }
        Returns: number
      }
      convertir_documento: {
        Args: {
          p_motivo?: string
          p_origen: number
          p_tipo: Database["public"]["Enums"]["tipo_documento"]
        }
        Returns: number
      }
      duplicar_documento: {
        Args: { p_fecha?: string; p_origen: number }
        Returns: number
      }
      emitir_documento: {
        Args: { p_doc: number; p_fecha?: string }
        Returns: string
      }
      es_admin: { Args: never; Returns: boolean }
      formatear_numero: {
        Args: { p_anio: number; p_numero: number; p_serie: number }
        Returns: string
      }
      obtener_campana_publica: {
        Args: { p_token: string }
        Returns: {
          campana_estado: Database["public"]["Enums"]["estado_campana"]
          campana_nombre: string
          cliente_nombre: string
          direccion: string
          fecha_fin: string
          fecha_inicio: string
          latitud: number
          longitud: number
          punto_estado: Database["public"]["Enums"]["estado_punto"]
          punto_id: number
          punto_nombre: string
          tipo_soporte: Database["public"]["Enums"]["tipo_soporte"]
        }[]
      }
      obtener_fotos_publicas: {
        Args: { p_token: string }
        Returns: {
          latitud: number | null
          longitud: number | null
          origen_ubicacion: string | null
          punto_id: number
          punto_nombre: string
          tipo: Database["public"]["Enums"]["tipo_foto"]
          tomada_en: string
          url_foto: string
        }[]
      }
      precio_unitario: {
        Args: {
          p_alcance: Database["public"]["Enums"]["alcance_servicio"]
          p_cantidad: number
          p_cliente: number
          p_fecha?: string
          p_formato: number
          p_producto: number
        }
        Returns: number
      }
      recalcular_documento: { Args: { p_doc: number }; Returns: undefined }
      registrar_vista_enlace: { Args: { p_token: string }; Returns: undefined }
    }
    Enums: {
      alcance_servicio:
        | "fabricacion"
        | "instalacion"
        | "fabricacion_instalacion"
      estado_asignacion: "pendiente" | "en_curso" | "completada" | "cancelada"
      estado_campana: "planificada" | "en_curso" | "finalizada" | "cancelada"
      estado_documento:
        | "borrador"
        | "emitido"
        | "enviado"
        | "aceptado"
        | "rechazado"
        | "caducado"
        | "facturado"
        | "anulado"
      estado_punto:
        | "pendiente"
        | "instalado"
        | "verificado"
        | "incidencia"
        | "retirado"
      metodo_cobro:
        | "transferencia"
        | "efectivo"
        | "tarjeta"
        | "bizum"
        | "compensacion"
        | "otro"
      regimen_iva: "general" | "reducido" | "intracomunitario" | "exento"
      rol_asignacion: "instalador" | "supervisor" | "fotografo" | "retirador"
      rol_usuario: "admin" | "empleado"
      tipo_cliente:
        | "agencia_revendedor"
        | "promotor_productora"
        | "marca_empresa"
        | "institucion_asociacion"
        | "particular"
      tipo_documento:
        | "presupuesto"
        | "albaran"
        | "factura"
        | "rectificativa"
        | "recibo"
      tipo_documento_id: "NIF" | "CIF" | "NIE" | "VAT_UE" | "OTRO"
      tipo_foto: "antes" | "instalacion" | "despues" | "incidencia"
      tipo_persona: "juridica" | "fisica"
      tipo_soporte:
        | "valla"
        | "totem"
        | "lona"
        | "cartel"
        | "mobiliario_urbano"
        | "marquesina"
        | "pantalla"
        | "otro"
      unidad_venta: "ud" | "m2" | "ml" | "millar" | "mes" | "servicio" | "km"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      alcance_servicio: [
        "fabricacion",
        "instalacion",
        "fabricacion_instalacion",
      ],
      estado_asignacion: ["pendiente", "en_curso", "completada", "cancelada"],
      estado_campana: ["planificada", "en_curso", "finalizada", "cancelada"],
      estado_documento: [
        "borrador",
        "emitido",
        "enviado",
        "aceptado",
        "rechazado",
        "caducado",
        "facturado",
        "anulado",
      ],
      estado_punto: [
        "pendiente",
        "instalado",
        "verificado",
        "incidencia",
        "retirado",
      ],
      metodo_cobro: [
        "transferencia",
        "efectivo",
        "tarjeta",
        "bizum",
        "compensacion",
        "otro",
      ],
      regimen_iva: ["general", "reducido", "intracomunitario", "exento"],
      rol_asignacion: ["instalador", "supervisor", "fotografo", "retirador"],
      rol_usuario: ["admin", "empleado"],
      tipo_cliente: [
        "agencia_revendedor",
        "promotor_productora",
        "marca_empresa",
        "institucion_asociacion",
        "particular",
      ],
      tipo_documento: [
        "presupuesto",
        "albaran",
        "factura",
        "rectificativa",
        "recibo",
      ],
      tipo_documento_id: ["NIF", "CIF", "NIE", "VAT_UE", "OTRO"],
      tipo_foto: ["antes", "instalacion", "despues", "incidencia"],
      tipo_persona: ["juridica", "fisica"],
      tipo_soporte: [
        "valla",
        "totem",
        "lona",
        "cartel",
        "mobiliario_urbano",
        "marquesina",
        "pantalla",
        "otro",
      ],
      unidad_venta: ["ud", "m2", "ml", "millar", "mes", "servicio", "km"],
    },
  },
} as const
